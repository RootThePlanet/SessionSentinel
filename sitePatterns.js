(() => {
  const patterns = {
    "github.com": {
      displayName: "GitHub",
      cookiePatterns: ["user_session", "_gh_sess", "dotcom_user"],
      storageKeyPatterns: ["token", "oauth", "session"]
    },
    "google.com": {
      displayName: "Google",
      cookiePatterns: ["SID", "HSID", "SSID", "APISID", "SAPISID"],
      storageKeyPatterns: ["oauth", "token", "auth"]
    },
    "facebook.com": {
      displayName: "Facebook",
      cookiePatterns: ["c_user", "xs", "fr"],
      storageKeyPatterns: ["access_token", "session", "auth"]
    },
    "x.com": {
      displayName: "X",
      cookiePatterns: ["auth_token", "ct0", "twid"],
      storageKeyPatterns: ["token", "auth", "session"]
    },
    "twitter.com": {
      displayName: "Twitter",
      cookiePatterns: ["auth_token", "ct0", "twid"],
      storageKeyPatterns: ["token", "auth", "session"]
    },
    "amazon.com": {
      displayName: "Amazon",
      cookiePatterns: ["session-token", "session-id", "at-main"],
      storageKeyPatterns: ["session", "token", "auth"]
    },
    "microsoft.com": {
      displayName: "Microsoft",
      cookiePatterns: ["ESTSAUTHPERSISTENT", "ESTSAUTH", "MSCC"],
      storageKeyPatterns: ["token", "msal", "auth", "session"]
    }
  };

  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.SESSION_SENTINEL_SITE_PATTERNS = patterns;
})();
