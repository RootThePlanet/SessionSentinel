const api = globalThis.SessionSentinelApi || {
  runtime: chrome.runtime,
  storage: chrome.storage
};
const C = globalThis.SESSION_SENTINEL_CONSTANTS || {};
const DEFAULT_SETTINGS = C.DEFAULT_SETTINGS || {
  monitoringEnabled: true,
  alertSensitivity: "medium",
  notificationsEnabled: true,
  darkMode: "system",
  customPatterns: {}
};

// SVG icon fragments reused in JS-created elements
const ICON_X =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_CHECK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_ALERT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';

// ---------------------------------------------------------------------------
// Dark mode — supports "system" | "dark" | "light" (and legacy booleans)
// ---------------------------------------------------------------------------

function resolveDarkMode(setting) {
  if (setting === true || setting === "dark") return true;
  if (setting === false || setting === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDarkMode(darkModeSetting) {
  const isDark = resolveDarkMode(darkModeSetting);
  document.documentElement.classList.toggle("dark", isDark);
}

// Re-evaluate when OS theme changes (matters when set to "system")
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", async () => {
    const settings = await loadSettings();
    const dm = settings.darkMode;
    if (dm === "system" || dm === undefined || dm === null) {
      applyDarkMode(dm);
    }
  });

// ---------------------------------------------------------------------------
// Settings I/O
// ---------------------------------------------------------------------------

async function loadSettings() {
  try {
    const { settings = DEFAULT_SETTINGS } = await api.storage.local.get([
      "settings"
    ]);
    return { ...DEFAULT_SETTINGS, ...settings };
  } catch (_) {
    return { ...DEFAULT_SETTINGS };
  }
}

async function saveSettings(settings) {
  await api.storage.local.set({ settings });
}

// ---------------------------------------------------------------------------
// Custom pattern editor
// ---------------------------------------------------------------------------

function createPatternRow(domain, cookies, storage) {
  domain = domain || "";
  cookies = cookies || "";
  storage = storage || "";

  const row = document.createElement("div");
  row.className = "pattern-row";

  const domainInput = document.createElement("input");
  domainInput.type = "text";
  domainInput.placeholder = "domain.com";
  domainInput.value = domain;
  domainInput.setAttribute("aria-label", "Domain");

  const cookieInput = document.createElement("input");
  cookieInput.type = "text";
  cookieInput.placeholder = "cookie1, cookie2";
  cookieInput.value = cookies;
  cookieInput.setAttribute("aria-label", "Cookie names");

  const storageInput = document.createElement("input");
  storageInput.type = "text";
  storageInput.placeholder = "key1, key2";
  storageInput.value = storage;
  storageInput.setAttribute("aria-label", "Storage keys");

  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.innerHTML = ICON_X;
  removeBtn.title = "Remove pattern";
  removeBtn.setAttribute("aria-label", "Remove pattern");
  removeBtn.type = "button";
  removeBtn.addEventListener("click", () => row.remove());

  row.append(domainInput, cookieInput, storageInput, removeBtn);
  return row;
}

function loadPatternsIntoUI(customPatterns) {
  const container = document.getElementById("customPatterns");
  container.replaceChildren();
  for (const [domain, pattern] of Object.entries(customPatterns || {})) {
    const cookies = (pattern.cookiePatterns || []).join(", ");
    const storage = (pattern.storageKeyPatterns || []).join(", ");
    container.appendChild(createPatternRow(domain, cookies, storage));
  }
}

function collectPatternsFromUI() {
  const patterns = {};
  const rows = document.querySelectorAll("#customPatterns .pattern-row");
  rows.forEach((row) => {
    const inputs = row.querySelectorAll("input[type='text']");
    const domain = (inputs[0]?.value || "").trim().toLowerCase();
    const cookies = (inputs[1]?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const storage = (inputs[2]?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (domain && (cookies.length || storage.length)) {
      patterns[domain] = {
        displayName: domain,
        cookiePatterns: cookies,
        storageKeyPatterns: storage
      };
    }
  });
  return patterns;
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

function exportSettingsToFile(settings) {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    "session-sentinel-settings-" +
    new Date().toISOString().slice(0, 10) +
    ".json";
  a.click();
  URL.revokeObjectURL(url);
}

function importSettingsFromFile() {
  return new Promise((resolve, reject) => {
    const input = document.getElementById("importFile");
    input.value = "";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error("No file selected"));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(JSON.parse(reader.result));
        } catch (e) {
          reject(new Error("Invalid JSON file: " + e.message));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

function showStatus(msg, isError) {
  const el = document.getElementById("status");
  el.className = "status-msg visible " + (isError ? "error" : "success");
  el.innerHTML =
    (isError ? ICON_ALERT : ICON_CHECK) + " <span>" + msg + "</span>";
  setTimeout(() => {
    el.classList.remove("visible");
  }, 3000);
}

// ---------------------------------------------------------------------------
// Dark mode value normaliser (handles legacy booleans)
// ---------------------------------------------------------------------------

function normalizeDarkModeValue(stored) {
  if (stored === true) return "dark";
  if (stored === false) return "light";
  if (stored === "dark" || stored === "light" || stored === "system")
    return stored;
  return "system";
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function initialize() {
  const settings = await loadSettings();

  // Apply dark mode immediately
  applyDarkMode(settings.darkMode);

  // Show extension version from manifest
  try {
    const manifest = api.runtime.getManifest();
    document.getElementById("version").textContent = manifest.version;
  } catch (_) {
    document.getElementById("version").textContent = "\u2013";
  }

  // Populate form fields
  document.getElementById("monitoringEnabled").checked = Boolean(
    settings.monitoringEnabled
  );
  document.getElementById("notificationsEnabled").checked =
    settings.notificationsEnabled !== false;
  document.getElementById("darkMode").value = normalizeDarkModeValue(
    settings.darkMode
  );
  document.getElementById("alertSensitivity").value =
    settings.alertSensitivity || "medium";

  loadPatternsIntoUI(settings.customPatterns);

  // Live theme preview when changing dropdown
  document.getElementById("darkMode").addEventListener("change", (e) => {
    applyDarkMode(e.target.value);
  });

  // Add pattern row
  document.getElementById("addPattern").addEventListener("click", () => {
    document.getElementById("customPatterns").appendChild(createPatternRow());
  });

  // Save
  document.getElementById("save").addEventListener("click", async () => {
    const updated = {
      ...settings,
      monitoringEnabled:
        document.getElementById("monitoringEnabled").checked,
      notificationsEnabled:
        document.getElementById("notificationsEnabled").checked,
      darkMode: document.getElementById("darkMode").value,
      alertSensitivity: document.getElementById("alertSensitivity").value,
      customPatterns: collectPatternsFromUI()
    };
    await saveSettings(updated);
    showStatus("Settings saved successfully.");
  });

  // Export settings
  document
    .getElementById("exportSettings")
    .addEventListener("click", async () => {
      const current = await loadSettings();
      exportSettingsToFile(current);
    });

  // Import settings
  document
    .getElementById("importSettings")
    .addEventListener("click", async () => {
      try {
        const imported = await importSettingsFromFile();
        const merged = { ...DEFAULT_SETTINGS, ...imported };
        await saveSettings(merged);
        document.getElementById("monitoringEnabled").checked = Boolean(
          merged.monitoringEnabled
        );
        document.getElementById("notificationsEnabled").checked =
          merged.notificationsEnabled !== false;
        document.getElementById("darkMode").value = normalizeDarkModeValue(
          merged.darkMode
        );
        document.getElementById("alertSensitivity").value =
          merged.alertSensitivity || "medium";
        loadPatternsIntoUI(merged.customPatterns);
        applyDarkMode(merged.darkMode);
        showStatus("Settings imported successfully.");
      } catch (err) {
        showStatus(err.message, true);
      }
    });

  // Reset all data
  document.getElementById("resetAll").addEventListener("click", async () => {
    if (
      !confirm(
        "This will clear ALL data including alerts and token history. Continue?"
      )
    )
      return;
    try {
      await api.storage.local.clear();
      await saveSettings({ ...DEFAULT_SETTINGS });
      location.reload();
    } catch (err) {
      showStatus("Reset failed: " + err.message, true);
    }
  });
}

initialize();
