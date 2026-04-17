async function loadState() {
  if (!globalThis.chrome?.storage?.local) {
    return {
      settings: { monitoringEnabled: true, alertSensitivity: "medium" },
      alerts: []
    };
  }

  return chrome.storage.local.get(["settings", "alerts"]);
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function normalizeSeverity(severity) {
  return ["low", "medium", "high"].includes(severity) ? severity : "low";
}

function normalizeSensitivity(value) {
  return ["low", "medium", "high"].includes(value) ? value : "medium";
}

function renderAlert(alert) {
  const container = document.createElement("div");
  const severity = normalizeSeverity(alert.severity);
  container.className = `alert ${severity}`;

  const title = document.createElement("strong");
  title.textContent = alert.type || "anomaly";

  const br1 = document.createElement("br");
  const message = document.createElement("span");
  message.textContent = alert.message || "Anomaly detected";

  const br2 = document.createElement("br");
  const meta = document.createElement("small");
  meta.textContent = `${alert.site || "unknown site"} • ${formatTime(alert.createdAt)}`;

  container.append(title, br1, message, br2, meta);
  return container;
}

async function render() {
  const state = await loadState();
  const settings = state.settings || { monitoringEnabled: true, alertSensitivity: "medium" };
  const alerts = Array.isArray(state.alerts) ? state.alerts.slice(0, 10) : [];

  const metaEl = document.getElementById("meta");
  const alertsEl = document.getElementById("alerts");

  metaEl.textContent = `Monitoring: ${settings.monitoringEnabled ? "ON" : "OFF"} • Sensitivity: ${normalizeSensitivity(
    settings.alertSensitivity
  )}`;

  if (!alerts.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No suspicious session behavior detected yet.";
    alertsEl.replaceChildren(empty);
    return;
  }

  alertsEl.replaceChildren(...alerts.map((alert) => renderAlert(alert)));
}

render();
