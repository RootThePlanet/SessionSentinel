const api = globalThis.SessionSentinelApi || {
  runtime: chrome.runtime,
  storage: chrome.storage,
  action: chrome.action
};
const C = globalThis.SESSION_SENTINEL_CONSTANTS || {};
const MSG = C.MSG || {};
const SEVERITY_LEVELS = C.SEVERITY_LEVELS || ["low", "medium", "high"];
const MAX_POPUP_ALERTS = 50;

// ---------------------------------------------------------------------------
// SVG icon templates (inline, no external dependencies)
// ---------------------------------------------------------------------------

const ICONS = {
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  auto:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/><path d="M21 12.79A9 9 0 1 1 11.21 3" opacity="0.4"/></svg>',
  x:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  alertTriangle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  alertCircle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  shieldCheck:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>'
};

const SEVERITY_ICON = {
  high: ICONS.alertTriangle,
  medium: ICONS.alertCircle,
  low: ICONS.info
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let activeSeverityFilter = "all";
let expandedAlertId = null;

// ---------------------------------------------------------------------------
// Dark mode — supports "system" | "dark" | "light" (and legacy booleans)
// ---------------------------------------------------------------------------

function resolveDarkMode(setting) {
  if (setting === true || setting === "dark") return true;
  if (setting === false || setting === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

async function applyDarkMode() {
  try {
    const { settings = {} } = await api.storage.local.get(["settings"]);
    const isDark = resolveDarkMode(settings.darkMode);
    document.documentElement.classList.toggle("dark", isDark);
    updateThemeIcon(settings.darkMode);
  } catch (_) {
    /* ignore */
  }
}

function updateThemeIcon(darkModeSetting) {
  const btn = document.getElementById("toggleDark");
  if (
    darkModeSetting === "system" ||
    darkModeSetting === undefined ||
    darkModeSetting === null
  ) {
    btn.innerHTML = ICONS.auto;
    btn.title = "Theme: System";
  } else if (darkModeSetting === true || darkModeSetting === "dark") {
    btn.innerHTML = ICONS.moon;
    btn.title = "Theme: Dark";
  } else {
    btn.innerHTML = ICONS.sun;
    btn.title = "Theme: Light";
  }
}

async function toggleDarkMode() {
  const { settings = {} } = await api.storage.local.get(["settings"]);
  const current = settings.darkMode;
  // Cycle: system -> dark -> light -> system
  if (current === "system" || current === undefined || current === null) {
    settings.darkMode = "dark";
  } else if (current === true || current === "dark") {
    settings.darkMode = "light";
  } else {
    settings.darkMode = "system";
  }
  await api.storage.local.set({ settings });
  applyDarkMode();
}

// Re-evaluate when OS theme changes (relevant in "system" mode)
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => applyDarkMode());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function normalizeSeverity(severity) {
  return SEVERITY_LEVELS.includes(severity) ? severity : "low";
}

function normalizeSensitivity(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return Math.floor(diff / 86400000) + "d ago";
}

function prettifyType(type) {
  const label = type || "anomaly";
  return label
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAlertInsights(alert, severity) {
  const source = alert.source || "session";
  const token = alert.tokenName || "a monitored token";
  const site = alert.site || "this site";

  if (alert.type === "unexpected_token_change") {
    return {
      reason: `SessionSentinel observed ${token} changing repeatedly within a short time window on ${site}.`,
      severityReason:
        severity === "high"
          ? "Marked high because rapid token churn strongly suggests active session instability or tampering."
          : "Marked medium because repeated token changes can indicate unusual authentication behavior.",
      plainMeaning:
        "Your signed-in state may be getting replaced repeatedly. This can happen during risky account activity or aggressive re-authentication."
    };
  }

  if (alert.type === "possible_replay") {
    return {
      reason: `A previously seen ${token} value for ${site} appeared again in ${source}.`,
      severityReason:
        "Marked high because replayed session values are a strong indicator of token reuse risk.",
      plainMeaning:
        "An old sign-in token seems to be active again. That can mean someone reused a prior session."
    };
  }

  if (alert.type === "concurrent_session_usage") {
    return {
      reason: `${token} was detected in multiple browser stores/profiles for ${site}.`,
      severityReason:
        "Marked high because simultaneous reuse across stores can indicate session sharing or hijacking.",
      plainMeaning:
        "The same login session appears in more than one browser profile at once, which can be suspicious."
    };
  }

  return {
    reason: alert.message || `SessionSentinel flagged ${prettifyType(alert.type)} on ${site}.`,
    severityReason:
      severity === "high"
        ? "Marked high because this event matches a high-risk session behavior pattern."
        : severity === "medium"
          ? "Marked medium because this event is suspicious but less conclusive."
          : "Marked low because this is informational or lower-confidence suspicious behavior.",
    plainMeaning:
      "Something unusual was detected in your session activity. Review where and when this happened."
  };
}

function createDetailsRow(label, value) {
  const row = document.createElement("div");
  row.className = "alert-detail-row";

  const key = document.createElement("span");
  key.className = "alert-detail-label";
  key.textContent = label;

  const text = document.createElement("span");
  text.className = "alert-detail-text";
  text.textContent = value;

  row.append(key, text);
  return row;
}

function toggleAlertDetails(alertId) {
  expandedAlertId = expandedAlertId === alertId ? null : alertId;
  render();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderAlert(alert) {
  const container = document.createElement("div");
  const severity = normalizeSeverity(alert.severity);
  const isExpanded = expandedAlertId === alert.id;
  container.className = "alert " + severity;
  container.dataset.alertId = alert.id;
  container.classList.toggle("expanded", isExpanded);
  container.tabIndex = 0;
  container.setAttribute("role", "button");
  container.setAttribute(
    "aria-label",
    `${prettifyType(alert.type)} alert on ${alert.site || "unknown"}`
  );
  container.setAttribute("aria-expanded", String(isExpanded));
  container.title = "Click to view details";
  container.addEventListener("click", () => toggleAlertDetails(alert.id));
  container.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggleAlertDetails(alert.id);
  });

  // Severity icon
  const severityEl = document.createElement("div");
  severityEl.className = "alert-severity";
  const iconWrap = document.createElement("div");
  iconWrap.className = "severity-icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = SEVERITY_ICON[severity] || ICONS.info;
  severityEl.appendChild(iconWrap);

  // Content area
  const content = document.createElement("div");
  content.className = "alert-content";

  const header = document.createElement("div");
  header.className = "alert-header";
  const typeEl = document.createElement("span");
  typeEl.className = "alert-type";
  typeEl.textContent = alert.type?.replace(/_/g, " ") || "anomaly";
  const badge = document.createElement("span");
  badge.className = "alert-badge";
  badge.textContent = severity;
  header.append(typeEl, badge);

  const msg = document.createElement("div");
  msg.className = "alert-message";
  msg.textContent = alert.message || "Anomaly detected";

  const meta = document.createElement("div");
  meta.className = "alert-meta";
  const siteSpan = document.createElement("span");
  siteSpan.textContent = alert.site || "unknown";
  const sep1 = document.createElement("span");
  sep1.className = "alert-meta-sep";
  sep1.textContent = "\u00b7";
  sep1.setAttribute("aria-hidden", "true");
  const timeSpan = document.createElement("span");
  timeSpan.textContent = timeAgo(alert.createdAt);
  timeSpan.title = formatTime(alert.createdAt);
  meta.append(siteSpan, sep1, timeSpan);

  if (alert.source) {
    const sep2 = document.createElement("span");
    sep2.className = "alert-meta-sep";
    sep2.textContent = "\u00b7";
    sep2.setAttribute("aria-hidden", "true");
    const sourceSpan = document.createElement("span");
    sourceSpan.textContent = alert.source;
    meta.append(sep2, sourceSpan);
  }

  const insights = getAlertInsights(alert, severity);
  const details = document.createElement("div");
  details.className = "alert-details";
  details.hidden = !isExpanded;
  details.append(
    createDetailsRow("Reason", insights.reason),
    createDetailsRow("Severity", insights.severityReason),
    createDetailsRow("Meaning", insights.plainMeaning)
  );

  content.append(header, msg, meta, details);

  // Dismiss button
  const dismiss = document.createElement("button");
  dismiss.className = "dismiss-btn";
  dismiss.innerHTML = ICONS.x;
  dismiss.title = "Dismiss alert";
  dismiss.setAttribute("aria-label", "Dismiss alert");
  dismiss.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissAlert(alert.id);
  });

  container.append(severityEl, content, dismiss);
  return container;
}

function getFilteredAlerts(alerts) {
  const search = (document.getElementById("searchInput")?.value || "")
    .toLowerCase()
    .trim();

  return alerts.filter((a) => {
    if (a.dismissed) return false;
    if (activeSeverityFilter !== "all" && a.severity !== activeSeverityFilter)
      return false;
    if (search) {
      const haystack =
        (a.type + " " + a.message + " " + a.site + " " + (a.tokenName || "")).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function updateSeverityCounts(alerts) {
  const undismissed = alerts.filter((a) => !a.dismissed);
  const counts = { all: undismissed.length, high: 0, medium: 0, low: 0 };
  undismissed.forEach((a) => {
    const s = normalizeSeverity(a.severity);
    if (counts[s] !== undefined) counts[s]++;
  });
  document.getElementById("countAll").textContent = counts.all;
  document.getElementById("countHigh").textContent = counts.high;
  document.getElementById("countMed").textContent = counts.medium;
  document.getElementById("countLow").textContent = counts.low;
}

async function render() {
  const { settings = {}, alerts: rawAlerts = [] } =
    await api.storage.local.get(["settings", "alerts"]);
  const alerts = Array.isArray(rawAlerts)
    ? rawAlerts.slice(0, MAX_POPUP_ALERTS)
    : [];

  // Status bar
  const enabled = settings.monitoringEnabled !== false;
  const sensitivity = normalizeSensitivity(settings.alertSensitivity);
  const undismissedCount = alerts.filter((a) => !a.dismissed).length;

  document.getElementById("meta").textContent =
    (enabled ? "Active" : "Paused") +
    " \u00b7 Sensitivity: " +
    sensitivity +
    " \u00b7 " +
    undismissedCount +
    " alert" +
    (undismissedCount !== 1 ? "s" : "");

  document.getElementById("statusDot").classList.toggle("active", enabled);

  // Toggle monitoring button icon
  const toggleBtn = document.getElementById("toggleMonitor");
  toggleBtn.innerHTML = enabled ? ICONS.pause : ICONS.play;
  toggleBtn.title = enabled ? "Pause monitoring" : "Resume monitoring";
  toggleBtn.setAttribute(
    "aria-label",
    enabled ? "Pause monitoring" : "Resume monitoring"
  );
  toggleBtn.classList.toggle("monitoring-active", enabled);

  // Severity tab counts
  updateSeverityCounts(alerts);

  // Alert list
  const alertsEl = document.getElementById("alerts");
  const filtered = getFilteredAlerts(alerts);
  if (expandedAlertId && !filtered.some((a) => a.id === expandedAlertId)) {
    expandedAlertId = null;
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = alerts.length ? ICONS.shield : ICONS.shieldCheck;

    const title = document.createElement("div");
    title.className = "empty-title";
    title.textContent = alerts.length ? "No matching alerts" : "All clear";

    const desc = document.createElement("div");
    desc.className = "empty-desc";
    desc.textContent = alerts.length
      ? "Try adjusting your search or filter criteria."
      : "No suspicious session behavior detected. SessionSentinel is watching.";

    empty.append(icon, title, desc);
    alertsEl.replaceChildren(empty);
    return;
  }

  alertsEl.replaceChildren(...filtered.map(renderAlert));
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function dismissAlert(alertId) {
  try {
    api.runtime.sendMessage(
      { type: MSG.DISMISS_ALERT, alertId },
      () => {
        if (typeof chrome !== "undefined") void chrome.runtime.lastError;
        render();
      }
    );
  } catch (_) {
    render();
  }
}

async function clearAlerts() {
  if (!confirm("Clear all alerts?")) return;
  try {
    api.runtime.sendMessage({ type: MSG.CLEAR_ALERTS }, () => {
      if (typeof chrome !== "undefined") void chrome.runtime.lastError;
      render();
    });
  } catch (_) {
    render();
  }
}

async function exportAlerts() {
  const { alerts = [] } = await api.storage.local.get(["alerts"]);
  const blob = new Blob([JSON.stringify(alerts, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "session-sentinel-alerts-" +
    new Date().toISOString().slice(0, 10) +
    ".json";
  a.click();
  URL.revokeObjectURL(url);
}

async function toggleMonitoring() {
  api.runtime.sendMessage({ type: MSG.TOGGLE_MONITORING }, () => {
    if (typeof chrome !== "undefined") void chrome.runtime.lastError;
    render();
  });
}

// ---------------------------------------------------------------------------
// Severity filter tabs
// ---------------------------------------------------------------------------

function initSeverityTabs() {
  const container = document.getElementById("severityFilter");

  container.addEventListener("click", (e) => {
    const tab = e.target.closest(".severity-tab");
    if (!tab) return;

    container.querySelectorAll(".severity-tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");

    activeSeverityFilter = tab.dataset.severity;
    render();
  });

  // Keyboard navigation for tab group
  container.addEventListener("keydown", (e) => {
    const tabs = [...container.querySelectorAll(".severity-tab")];
    const current = tabs.findIndex((t) => t.classList.contains("active"));
    let next = current;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (current + 1) % tabs.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (current - 1 + tabs.length) % tabs.length;
    } else {
      return;
    }

    e.preventDefault();
    tabs[next].click();
    tabs[next].focus();
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

applyDarkMode();
render();
initSeverityTabs();

document
  .getElementById("toggleMonitor")
  .addEventListener("click", toggleMonitoring);
document
  .getElementById("toggleDark")
  .addEventListener("click", toggleDarkMode);
document
  .getElementById("openOptions")
  .addEventListener("click", () => api.runtime.openOptionsPage());
document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("exportBtn").addEventListener("click", exportAlerts);
document.getElementById("clearBtn").addEventListener("click", clearAlerts);
