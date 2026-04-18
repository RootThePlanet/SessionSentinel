const api = globalThis.SessionSentinelApi || {
  runtime: chrome.runtime,
  storage: chrome.storage,
  action: chrome.action
};
const C = globalThis.SESSION_SENTINEL_CONSTANTS || {};
const MSG = C.MSG || {};
const SEVERITY_LEVELS = C.SEVERITY_LEVELS || ["low", "medium", "high"];
const MAX_POPUP_ALERTS = 50;
const INCIDENT_KEY_SEPARATOR = "::";

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
      reason: `The ${source} token "${token}" on ${site} changed multiple times within a short window.`,
      severityReason:
        "Rated low because many websites routinely rotate session tokens as a security measure to prevent theft. This is usually expected behavior.",
      plainMeaning:
        "Your session token was refreshed several times in quick succession. Most sites do this intentionally to protect your account — it's a standard security practice called token rotation.",
      recommendation:
        "No action needed. This is almost always normal. Only investigate if you also see unexpected account activity (e.g. password change emails, unfamiliar logins) or if you were not actively using the site at the time."
    };
  }

  if (alert.type === "possible_replay") {
    return {
      reason: `A previously used value for "${token}" on ${site} has reappeared in ${source}. This means a token that was already replaced is now active again.`,
      severityReason:
        "Rated high because a replayed token can indicate that someone captured an old session value and is attempting to reuse it to gain access to your account.",
      plainMeaning:
        "An old login token that should have been expired or replaced is being used again. This is a potential sign of session hijacking — someone may have stolen a previous token and is replaying it.",
      recommendation:
        "Take action: Log out of the affected site and log back in to force a new session. If available, revoke all active sessions from the site's security settings. Change your password if you suspect unauthorized access."
    };
  }

  if (alert.type === "concurrent_session_usage") {
    return {
      reason: `The token "${token}" for ${site} was found active in multiple browser cookie stores simultaneously. This means the same session credential exists in more than one browser profile or container.`,
      severityReason:
        "Rated high because a legitimate session token should only exist in one browser context. Duplication across stores can indicate the token was copied or exported.",
      plainMeaning:
        "Your login session for this site is active in multiple browser profiles at the same time. This could mean someone copied your session cookie to another browser to impersonate you.",
      recommendation:
        "Take action: Log out of the affected site across all profiles. Revoke active sessions from the site's security settings if available. If you intentionally use multiple profiles on the same site, you can dismiss this alert."
    };
  }

  return {
    reason: alert.message || `SessionSentinel flagged ${prettifyType(alert.type)} on ${site}.`,
    severityReason:
      severity === "high"
        ? "Rated high because this event matches a pattern strongly associated with session compromise."
        : severity === "medium"
          ? "Rated medium because this event is suspicious but not conclusive on its own."
          : "Rated low — this is informational. The detected behavior is likely normal but was logged for your awareness.",
    plainMeaning:
      "Something unusual was detected in your session activity. Review the details to determine if this aligns with your recent actions on the site.",
    recommendation:
      severity === "high"
        ? "Take action: Review your account activity on the affected site and consider logging out and back in."
        : "No action needed unless you notice other suspicious activity on the affected site."
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

function alertSiteLabel(alert) {
  return alert.site || "Unknown site";
}

function alertTypeLabel(alert) {
  return alert.type || "anomaly";
}

function buildIncidents(alerts) {
  const grouped = new Map();
  for (const alert of alerts) {
    if (alert.dismissed) continue;
    const site = alertSiteLabel(alert);
    const type = alertTypeLabel(alert);
    const key = `${site}${INCIDENT_KEY_SEPARATOR}${type}`;
    const severity = normalizeSeverity(alert.severity);
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: key,
        site,
        type,
        severity,
        source: alert.source,
        tokenName: alert.tokenName,
        createdAt: alert.createdAt || 0,
        message: alert.message || "Anomaly detected",
        eventCount: 0
      });
    }

    const incident = grouped.get(key);
    incident.eventCount += 1;
    if ((alert.createdAt || 0) > incident.createdAt) {
      incident.createdAt = alert.createdAt || incident.createdAt;
      incident.message = alert.message || incident.message;
      incident.source = alert.source || incident.source;
      incident.tokenName = alert.tokenName || incident.tokenName;
      incident.severity = severity;
    }
  }
  return [...grouped.values()].sort((a, b) => b.createdAt - a.createdAt);
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

  const sepEvents = document.createElement("span");
  sepEvents.className = "alert-meta-sep";
  sepEvents.textContent = "\u00b7";
  sepEvents.setAttribute("aria-hidden", "true");
  const eventCountSpan = document.createElement("span");
  const eventCount = alert.eventCount || 1;
  eventCountSpan.textContent =
    `${eventCount} event` + (eventCount !== 1 ? "s" : "");
  meta.append(sepEvents, eventCountSpan);

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
    createDetailsRow("Why this was flagged", insights.reason),
    createDetailsRow("Severity rationale", insights.severityReason),
    createDetailsRow("What this means", insights.plainMeaning),
    createDetailsRow("Recommended action", insights.recommendation)
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
  const counts = { all: alerts.length, high: 0, medium: 0, low: 0 };
  alerts.forEach((a) => {
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
  const incidents = buildIncidents(alerts);

  // Status bar
  const enabled = settings.monitoringEnabled !== false;
  const sensitivity = normalizeSensitivity(settings.alertSensitivity);
  const undismissedCount = incidents.length;

  document.getElementById("meta").textContent =
    (enabled ? "Active" : "Paused") +
    " \u00b7 Sensitivity: " +
    sensitivity +
    " \u00b7 " +
    undismissedCount +
    " incident" +
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
  updateSeverityCounts(incidents);

  // Alert list
  const alertsEl = document.getElementById("alerts");
  const filtered = getFilteredAlerts(incidents);
  if (expandedAlertId && !filtered.some((a) => a.id === expandedAlertId)) {
    expandedAlertId = null;
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = incidents.length ? ICONS.shield : ICONS.shieldCheck;

    const title = document.createElement("div");
    title.className = "empty-title";
    title.textContent = incidents.length ? "No matching incidents" : "All clear";

    const desc = document.createElement("div");
    desc.className = "empty-desc";
    desc.textContent = incidents.length
      ? "Try adjusting your search or filter criteria."
      : "No suspicious session behavior detected. SessionSentinel is watching.";

    empty.append(icon, title, desc);
    alertsEl.replaceChildren(empty);
    return;
  }

  // Group alerts by site
  const groups = new Map();
  for (const a of filtered) {
    const site = a.site || "Unknown site";
    if (!groups.has(site)) groups.set(site, []);
    groups.get(site).push(a);
  }

  const fragment = document.createDocumentFragment();
  for (const [site, siteAlerts] of groups) {
    // Site group header
    const header = document.createElement("div");
    header.className = "site-group-header";
    const siteLabel = document.createElement("span");
    siteLabel.className = "site-group-name";
    siteLabel.textContent = site;
    const countBadge = document.createElement("span");
    countBadge.className = "site-group-count";
    countBadge.textContent = siteAlerts.length;
    header.append(siteLabel, countBadge);
    fragment.appendChild(header);

    // Alerts for this site
    for (const a of siteAlerts) {
      fragment.appendChild(renderAlert(a));
    }
  }
  alertsEl.replaceChildren(fragment);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function dismissAlert(incidentId) {
  try {
    const [incidentSite, incidentType] = String(incidentId || "").split(
      INCIDENT_KEY_SEPARATOR
    );
    const { alerts = [] } = await api.storage.local.get(["alerts"]);
    const updated = alerts.map((a) => {
      if (
        !a.dismissed &&
        alertSiteLabel(a) === incidentSite &&
        alertTypeLabel(a) === incidentType
      ) {
        return { ...a, dismissed: true };
      }
      return a;
    });
    await api.storage.local.set({ alerts: updated });
    render();
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
