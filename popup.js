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

async function render() {
  const state = await loadState();
  const settings = state.settings || { monitoringEnabled: true, alertSensitivity: "medium" };
  const alerts = Array.isArray(state.alerts) ? state.alerts.slice(0, 10) : [];

  const metaEl = document.getElementById("meta");
  const alertsEl = document.getElementById("alerts");

  metaEl.textContent = `Monitoring: ${settings.monitoringEnabled ? "ON" : "OFF"} • Sensitivity: ${settings.alertSensitivity}`;

  if (!alerts.length) {
    alertsEl.innerHTML = '<div class="empty">No suspicious session behavior detected yet.</div>';
    return;
  }

  alertsEl.innerHTML = alerts
    .map(
      (alert) => `
      <div class="alert ${alert.severity || "low"}">
        <strong>${alert.type}</strong><br />
        <span>${alert.message || "Anomaly detected"}</span><br />
        <small>${alert.site || "unknown site"} • ${formatTime(alert.createdAt)}</small>
      </div>
    `
    )
    .join("");
}

render();
