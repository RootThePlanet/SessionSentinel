const DEFAULT_SETTINGS = {
  monitoringEnabled: true,
  alertSensitivity: "medium"
};

async function loadSettings() {
  if (!globalThis.chrome?.storage?.local) {
    return DEFAULT_SETTINGS;
  }

  const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get(["settings"]);
  return { ...DEFAULT_SETTINGS, ...settings };
}

async function saveSettings(settings) {
  if (!globalThis.chrome?.storage?.local) {
    return;
  }

  await chrome.storage.local.set({ settings });
}

async function initialize() {
  const monitorCheckbox = document.getElementById("monitoringEnabled");
  const sensitivitySelect = document.getElementById("alertSensitivity");
  const saveButton = document.getElementById("save");
  const status = document.getElementById("status");

  const settings = await loadSettings();
  monitorCheckbox.checked = Boolean(settings.monitoringEnabled);
  sensitivitySelect.value = settings.alertSensitivity;

  saveButton.addEventListener("click", async () => {
    const updated = {
      monitoringEnabled: monitorCheckbox.checked,
      alertSensitivity: sensitivitySelect.value
    };

    await saveSettings(updated);
    status.textContent = "Settings saved.";
    setTimeout(() => {
      status.textContent = "";
    }, 1500);
  });
}

initialize();
