if (typeof importScripts === "function") {
  importScripts("browserApi.js", "constants.js", "sitePatterns.js");
}

const {
  DEFAULT_SETTINGS,
  SENSITIVITY_RULES,
  GENERIC_TOKEN_KEYWORDS,
  MAX_ALERTS,
  MAX_HISTORY,
  MSG
} = globalThis.SESSION_SENTINEL_CONSTANTS;

const api = globalThis.SessionSentinelApi || {
  runtime: chrome.runtime,
  storage: chrome.storage,
  cookies: chrome.cookies,
  action: chrome.action,
  notifications: chrome.notifications
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDomain(domain = "") {
  return domain.replace(/^\./, "").toLowerCase();
}

function getAllPatterns() {
  const builtIn = globalThis.SESSION_SENTINEL_SITE_PATTERNS || {};
  const custom = globalThis._ssCustomPatterns || {};
  return { ...builtIn, ...custom };
}

function patternForHost(hostname = "") {
  const host = hostname.toLowerCase();
  const patterns = getAllPatterns();
  return (
    Object.entries(patterns).find(
      ([domain]) => host === domain || host.endsWith(`.${domain}`)
    )?.[1] || null
  );
}

function matchesTokenName(name, host) {
  if (!name) return false;
  const sitePattern = patternForHost(host);
  if (
    sitePattern?.cookiePatterns?.some((kw) =>
      name.toLowerCase().includes(kw.toLowerCase())
    )
  )
    return true;
  return GENERIC_TOKEN_KEYWORDS.test(name);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getState() {
  return api.storage.local.get(["settings", "tokenState", "alerts"]);
}

function trimAlertList(alerts) {
  return Array.isArray(alerts) ? alerts.slice(0, MAX_ALERTS) : [];
}

function buildAlert(type, severity, details) {
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    type,
    severity,
    ...details
  };
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

async function updateBadge() {
  try {
    const { alerts = [] } = await api.storage.local.get(["alerts"]);
    const undismissed = alerts.filter((a) => !a.dismissed);
    const count = undismissed.length;
    const text = count > 0 ? String(count > 99 ? "99+" : count) : "";
    const color = undismissed.some((a) => a.severity === "high")
      ? "#ef4444"
      : undismissed.some((a) => a.severity === "medium")
        ? "#f59e0b"
        : "#3b82f6";

    await api.action.setBadgeText({ text });
    await api.action.setBadgeBackgroundColor({ color });
  } catch (_) {
    // action API may not be available in all contexts
  }
}

// ---------------------------------------------------------------------------
// Browser notifications
// ---------------------------------------------------------------------------

async function showNotification(alert) {
  try {
    const { settings = DEFAULT_SETTINGS } = await api.storage.local.get([
      "settings"
    ]);
    if (!settings.notificationsEnabled) return;
    if (alert.severity !== "high") return;
    if (!api.notifications) return;

    api.notifications.create(alert.id, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "SessionSentinel \u2014 " + alert.type.replace(/_/g, " "),
      message: alert.message || "Suspicious session activity detected.",
      priority: 2
    });
  } catch (_) {
    // notifications permission may not be granted
  }
}

// ---------------------------------------------------------------------------
// Token observation pipeline
// ---------------------------------------------------------------------------

async function processTokenObservation({
  source,
  site,
  tokenName,
  tokenValue,
  storeId
}) {
  if (!site || !tokenName || !tokenValue) return;

  const {
    settings = DEFAULT_SETTINGS,
    tokenState = {},
    alerts = []
  } = await getState();
  if (!settings.monitoringEnabled) return;

  const sensitivity =
    settings.alertSensitivity in SENSITIVITY_RULES
      ? settings.alertSensitivity
      : "medium";
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

  // Only set firstSeenAt once
  if (!previous.firstSeenAt) {
    previous.firstSeenAt = now;
  }

  const previousHistory = previous.hashHistory || [];
  const trimmedHistory =
    previousHistory.length >= MAX_HISTORY
      ? previousHistory.slice(-(MAX_HISTORY - 1))
      : previousHistory;
  const hashHistory = [...trimmedHistory, { hash: tokenHash, at: now }];

  const next = { ...previous, lastSeenAt: now, hashHistory };

  if (previous.lastHash && previous.lastHash !== tokenHash) {
    const recentChanges = (previous.changes || []).filter(
      (ts) => now - ts <= rules.windowMs
    );
    recentChanges.push(now);
    next.changes = recentChanges;

    if (recentChanges.length >= rules.changeThreshold) {
      alertsToAdd.push(
        buildAlert(
          "unexpected_token_change",
          "low",
          {
            site,
            source,
            tokenName,
            message: `Frequent ${source} token changes detected for ${tokenName} on ${site}.`
          }
        )
      );
    }

    const replayed = (previous.hashHistory || []).some(
      (entry) => entry.hash === tokenHash
    );
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
    const existingStores = next.storeIdsByHash[tokenHash] || [];
    const hasStore = existingStores.includes(storeId);
    const stores = hasStore ? existingStores : [...existingStores, storeId];
    next.storeIdsByHash[tokenHash] = stores;

    if (!hasStore && stores.length > 1) {
      alertsToAdd.push(
        buildAlert("concurrent_session_usage", "high", {
          site,
          source,
          tokenName,
          message: `Cookie token ${tokenName} appears in multiple browser stores for ${site}.`,
          metadata: { storeIds: stores }
        })
      );
    }
  }

  if (next.storeIdsByHash && typeof next.storeIdsByHash === "object") {
    const hashesInHistory = new Set(
      next.hashHistory.map((entry) => entry.hash)
    );
    next.storeIdsByHash = Object.fromEntries(
      Object.entries(next.storeIdsByHash).filter(([hash]) =>
        hashesInHistory.has(hash)
      )
    );
  }

  next.lastHash = tokenHash;
  tokenState[key] = next;
  const updates = { tokenState };
  if (alertsToAdd.length) {
    updates.alerts = trimAlertList([...alertsToAdd, ...alerts]);
  }
  await api.storage.local.set(updates);

  if (alertsToAdd.length) {
    await updateBadge();
    for (const a of alertsToAdd) await showNotification(a);
  }
}

// ---------------------------------------------------------------------------
// Load custom patterns from storage into memory
// ---------------------------------------------------------------------------

async function loadCustomPatterns() {
  try {
    const { settings = DEFAULT_SETTINGS } = await api.storage.local.get([
      "settings"
    ]);
    globalThis._ssCustomPatterns = settings.customPatterns || {};
  } catch (_) {
    globalThis._ssCustomPatterns = {};
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

api.runtime.onInstalled.addListener(async () => {
  try {
    const state = await api.storage.local.get([
      "settings",
      "alerts",
      "tokenState"
    ]);
    await api.storage.local.set({
      settings: { ...DEFAULT_SETTINGS, ...(state.settings || {}) },
      alerts: Array.isArray(state.alerts) ? state.alerts : [],
      tokenState: state.tokenState || {}
    });
    await loadCustomPatterns();
    await updateBadge();
  } catch (err) {
    console.error("[SessionSentinel] onInstalled error:", err);
  }
});

// Reload custom patterns when settings change
api.storage.onChanged.addListener((changes) => {
  if (changes.settings) loadCustomPatterns();
  if (changes.alerts) updateBadge();
});

// ---------------------------------------------------------------------------
// Cookie monitoring
// ---------------------------------------------------------------------------

api.cookies.onChanged.addListener(async ({ cookie, removed }) => {
  if (removed || !cookie?.value) return;
  const site = normalizeDomain(cookie.domain);
  if (!matchesTokenName(cookie.name, site)) return;

  try {
    await processTokenObservation({
      source: "cookie",
      site,
      tokenName: cookie.name,
      tokenValue: cookie.value,
      storeId: cookie.storeId
    });
  } catch (err) {
    console.error("[SessionSentinel] cookie observation error:", err);
  }
});

// ---------------------------------------------------------------------------
// Message handling
// ---------------------------------------------------------------------------

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return false;

  // --- localStorage snapshot from content script ---
  if (message.type === MSG.LOCAL_STORAGE_SNAPSHOT) {
    const senderHost = sender?.url ? new URL(sender.url).hostname : "";
    const site = message.payload?.hostname || senderHost;
    const entries = Array.isArray(message.payload?.entries)
      ? message.payload.entries
      : [];

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
  }

  // --- Dismiss a single alert ---
  if (message.type === MSG.DISMISS_ALERT) {
    api.storage.local.get(["alerts"]).then(({ alerts = [] }) => {
      const updated = alerts.map((a) =>
        a.id === message.alertId ? { ...a, dismissed: true } : a
      );
      api.storage.local.set({ alerts: updated }).then(() => {
        updateBadge();
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  // --- Clear all alerts ---
  if (message.type === MSG.CLEAR_ALERTS) {
    api.storage.local.set({ alerts: [] }).then(() => {
      updateBadge();
      sendResponse({ ok: true });
    });
    return true;
  }

  // --- Export alerts as JSON ---
  if (message.type === MSG.EXPORT_ALERTS) {
    api.storage.local.get(["alerts"]).then(({ alerts = [] }) => {
      sendResponse({ ok: true, data: alerts });
    });
    return true;
  }

  // --- Get full state (for popup) ---
  if (message.type === MSG.GET_STATE) {
    getState()
      .then((state) => sendResponse({ ok: true, ...state }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  // --- Quick toggle monitoring ---
  if (message.type === MSG.TOGGLE_MONITORING) {
    api.storage.local
      .get(["settings"])
      .then(({ settings = DEFAULT_SETTINGS }) => {
        const updated = {
          ...settings,
          monitoringEnabled: !settings.monitoringEnabled
        };
        api.storage.local.set({ settings: updated }).then(() =>
          sendResponse({
            ok: true,
            monitoringEnabled: updated.monitoringEnabled
          })
        );
      });
    return true;
  }

  return false;
});
