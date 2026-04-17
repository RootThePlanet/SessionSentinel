/**
 * Shared constants used across background, content, popup, and options pages.
 */
(() => {
  const root = typeof globalThis !== "undefined" ? globalThis : window;

  root.SESSION_SENTINEL_CONSTANTS = Object.freeze({
    DEFAULT_SETTINGS: Object.freeze({
      monitoringEnabled: true,
      alertSensitivity: "medium",
      notificationsEnabled: true,
      darkMode: "system",
      customPatterns: {}
    }),

    SENSITIVITY_RULES: Object.freeze({
      high: Object.freeze({ changeThreshold: 1, windowMs: 10 * 60 * 1000 }),
      medium: Object.freeze({ changeThreshold: 2, windowMs: 15 * 60 * 1000 }),
      low: Object.freeze({ changeThreshold: 3, windowMs: 20 * 60 * 1000 })
    }),

    GENERIC_TOKEN_KEYWORDS: /(token|session|auth|jwt|sid|csrf|bearer)/i,

    MAX_ALERTS: 100,
    MAX_HISTORY: 20,

    /** Content-script polling interval in milliseconds. */
    POLLING_INTERVAL_MS: 30 * 1000,

    /** Maximum localStorage value length captured per entry. */
    MAX_VALUE_LENGTH: 4096,

    /** Message types for runtime messaging. */
    MSG: Object.freeze({
      LOCAL_STORAGE_SNAPSHOT: "LOCAL_STORAGE_SNAPSHOT",
      DISMISS_ALERT: "DISMISS_ALERT",
      CLEAR_ALERTS: "CLEAR_ALERTS",
      EXPORT_ALERTS: "EXPORT_ALERTS",
      GET_STATE: "GET_STATE",
      TOGGLE_MONITORING: "TOGGLE_MONITORING"
    }),

    SEVERITY_LEVELS: Object.freeze(["low", "medium", "high"])
  });
})();
