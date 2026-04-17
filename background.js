if (typeof importScripts === "function") {
  importScripts("sitePatterns.js");
}

const DEFAULT_SETTINGS = {
  monitoringEnabled: true,
  alertSensitivity: "medium"
};

const SENSITIVITY_RULES = {
  high: { changeThreshold: 1, windowMs: 10 * 60 * 1000 },
  medium: { changeThreshold: 2, windowMs: 15 * 60 * 1000 },
  low: { changeThreshold: 3, windowMs: 20 * 60 * 1000 }
};

const GENERIC_TOKEN_KEYWORDS = /(token|session|auth|jwt|sid|csrf|bearer)/i;
const MAX_ALERTS = 100;
const MAX_HISTORY = 20;

function normalizeDomain(domain = "") {
  return domain.replace(/^\./, "").toLowerCase();
}

function patternForHost(hostname = "") {
  const host = hostname.toLowerCase();
  const patterns = globalThis.SESSION_SENTINEL_SITE_PATTERNS || {};
  return Object.entries(patterns).find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || null;
}

function matchesTokenName(name, host) {
  if (!name) {
    return false;
  }

  const sitePattern = patternForHost(host);
  if (sitePattern?.cookiePatterns?.some((keyword) => name.toLowerCase().includes(keyword.toLowerCase()))) {
    return true;
  }

  return GENERIC_TOKEN_KEYWORDS.test(name);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getState() {
  return chrome.storage.local.get(["settings", "tokenState", "alerts"]);
}

function trimAlertList(alerts) {
  if (!Array.isArray(alerts)) {
    return [];
  }
  return alerts.slice(0, MAX_ALERTS);
}

function buildAlert(type, severity, details) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: Date.now(),
    type,
    severity,
    ...details
  };
}

async function processTokenObservation({ source, site, tokenName, tokenValue, storeId }) {
  if (!site || !tokenName || !tokenValue) {
    return;
  }

  const { settings = DEFAULT_SETTINGS, tokenState = {}, alerts = [] } = await getState();
  if (!settings.monitoringEnabled) {
    return;
  }

  const sensitivity = settings.alertSensitivity in SENSITIVITY_RULES ? settings.alertSensitivity : "medium";
  const rules = SENSITIVITY_RULES[sensitivity];
  const alertsToAdd = [];

  const key = `${source}|${site}|${tokenName}`;
  const now = Date.now();
  const tokenHash = await sha256(tokenValue);

  const previous = tokenState[key] || {
    lastHash: null,
    lastSeenAt: 0,
    changes: [],
    storeIdsByHash: {},
    hashHistory: []
  };

  const next = {
    ...previous,
    lastSeenAt: now,
    hashHistory: [...(previous.hashHistory || []), { hash: tokenHash, at: now }].slice(-MAX_HISTORY)
  };

  if (previous.lastHash && previous.lastHash !== tokenHash) {
    const freshChanges = [...(previous.changes || []), now].filter((ts) => now - ts <= rules.windowMs);
    next.changes = freshChanges;

    if (freshChanges.length >= rules.changeThreshold) {
      alertsToAdd.push(
        buildAlert("unexpected_token_change", sensitivity === "high" ? "high" : "medium", {
          site,
          source,
          tokenName,
          message: `Frequent ${source} token changes detected for ${tokenName} on ${site}.`
        })
      );
    }

    const replayed = (previous.hashHistory || []).some((entry) => entry.hash === tokenHash);
    if (replayed) {
      alertsToAdd.push(
        buildAlert("possible_replay", "high", {
          site,
          source,
          tokenName,
          message: `Previously seen ${source} token reappeared for ${tokenName} on ${site}.`
        })
      );
    }
  } else {
    next.changes = previous.changes || [];
  }

  if (source === "cookie" && storeId) {
    const stores = new Set(next.storeIdsByHash[tokenHash] || []);
    stores.add(storeId);
    next.storeIdsByHash[tokenHash] = [...stores];

    if (stores.size > 1) {
      alertsToAdd.push(
        buildAlert("concurrent_session_usage", "high", {
          site,
          source,
          tokenName,
          message: `Cookie token ${tokenName} appears in multiple browser stores for ${site}.`,
          metadata: { storeIds: [...stores] }
        })
      );
    }
  }

  next.lastHash = tokenHash;
  tokenState[key] = next;
  const updates = { tokenState };
  if (alertsToAdd.length) {
    updates.alerts = trimAlertList([...alertsToAdd, ...alerts]);
  }
  await chrome.storage.local.set(updates);
}

chrome.runtime.onInstalled.addListener(async () => {
  const state = await chrome.storage.local.get(["settings", "alerts", "tokenState"]);
  await chrome.storage.local.set({
    settings: { ...DEFAULT_SETTINGS, ...(state.settings || {}) },
    alerts: Array.isArray(state.alerts) ? state.alerts : [],
    tokenState: state.tokenState || {}
  });
});

chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
  if (removed || !cookie?.value) {
    return;
  }

  const site = normalizeDomain(cookie.domain);
  if (!matchesTokenName(cookie.name, site)) {
    return;
  }

  await processTokenObservation({
    source: "cookie",
    site,
    tokenName: cookie.name,
    tokenValue: cookie.value,
    storeId: cookie.storeId
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "LOCAL_STORAGE_SNAPSHOT") {
    return false;
  }

  const senderHost = sender?.url ? new URL(sender.url).hostname : "";
  const site = message.payload?.hostname || senderHost;
  const entries = Array.isArray(message.payload?.entries) ? message.payload.entries : [];

  Promise.all(
    entries
      .filter((entry) => matchesTokenName(entry.key, site))
      .map((entry) =>
        processTokenObservation({
          source: "localStorage",
          site,
          tokenName: entry.key,
          tokenValue: entry.value,
          storeId: "localStorage"
        })
      )
  )
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});
