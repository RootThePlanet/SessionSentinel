/**
 * Cross-browser API abstraction layer.
 *
 * Firefox exposes Promise-based APIs on the global `browser` object while
 * Chrome uses callback-based APIs on `chrome`.  This module normalises the
 * difference so the rest of the extension can use a single, consistent
 * interface regardless of the runtime.
 */
(() => {
  const root = typeof globalThis !== "undefined" ? globalThis : window;

  // Firefox provides `browser`; Chrome provides `chrome`.
  const api =
    typeof browser !== "undefined" && browser?.runtime
      ? browser
      : typeof chrome !== "undefined" && chrome?.runtime
        ? chrome
        : {};

  root.SessionSentinelApi = {
    runtime: api.runtime,
    storage: api.storage,
    cookies: api.cookies,
    alarms: api.alarms,
    tabs: api.tabs,
    action: api.action || api.browserAction,
    notifications: api.notifications,

    /** True when running in a Firefox-like environment. */
    isFirefox: typeof browser !== "undefined" && !!browser?.runtime,

    /** True when running in a service-worker (Chrome MV3). */
    isServiceWorker: typeof ServiceWorkerGlobalScope !== "undefined"
  };
})();
