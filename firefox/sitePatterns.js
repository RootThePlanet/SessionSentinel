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
    },
    "apple.com": {
      displayName: "Apple",
      cookiePatterns: ["myacinfo", "acn01", "dqsid"],
      storageKeyPatterns: ["token", "auth", "session", "idms"]
    },
    "linkedin.com": {
      displayName: "LinkedIn",
      cookiePatterns: ["li_at", "JSESSIONID", "liap"],
      storageKeyPatterns: ["token", "auth", "session", "linkedin"]
    },
    "reddit.com": {
      displayName: "Reddit",
      cookiePatterns: ["reddit_session", "token_v2", "session_tracker"],
      storageKeyPatterns: ["token", "auth", "session", "reddit"]
    },
    "netflix.com": {
      displayName: "Netflix",
      cookiePatterns: ["NetflixId", "SecureNetflixId", "nfvdid"],
      storageKeyPatterns: ["token", "auth", "session", "netflix"]
    },
    "paypal.com": {
      displayName: "PayPal",
      cookiePatterns: ["x-pp-s", "ts", "akavpau_ppsd"],
      storageKeyPatterns: ["token", "auth", "session", "paypal"]
    },
    "dropbox.com": {
      displayName: "Dropbox",
      cookiePatterns: ["t", "js_csrf", "locale"],
      storageKeyPatterns: ["token", "auth", "session", "dropbox"]
    },
    "slack.com": {
      displayName: "Slack",
      cookiePatterns: ["d", "x", "b"],
      storageKeyPatterns: ["token", "auth", "session", "slack"]
    },
    "zoom.us": {
      displayName: "Zoom",
      cookiePatterns: ["_zm_ssid", "zm_aid", "cred"],
      storageKeyPatterns: ["token", "auth", "session", "zoom"]
    },
    "adobe.com": {
      displayName: "Adobe",
      cookiePatterns: ["AUID", "AMCV", "adobeid"],
      storageKeyPatterns: ["token", "auth", "session", "adobe"]
    },
    "cloudflare.com": {
      displayName: "Cloudflare",
      cookiePatterns: ["CF_Authorization", "CF_Authorization_Session", "cf_clearance"],
      storageKeyPatterns: ["token", "auth", "session", "cloudflare"]
    },
    "salesforce.com": {
      displayName: "Salesforce",
      cookiePatterns: ["sid", "inst", "oid"],
      storageKeyPatterns: ["token", "auth", "session", "salesforce"]
    },
    "spotify.com": {
      displayName: "Spotify",
      cookiePatterns: ["sp_dc", "sp_key", "remember"],
      storageKeyPatterns: ["token", "auth", "session", "spotify"]
    },
    "tiktok.com": {
      displayName: "TikTok",
      cookiePatterns: ["sessionid", "sid_tt", "ttwid"],
      storageKeyPatterns: ["token", "auth", "session", "tiktok"]
    },
    "instagram.com": {
      displayName: "Instagram",
      cookiePatterns: ["sessionid", "ds_user_id", "csrftoken"],
      storageKeyPatterns: ["token", "auth", "session", "instagram"]
    },
    "yahoo.com": {
      displayName: "Yahoo",
      cookiePatterns: ["A1", "A3", "B"],
      storageKeyPatterns: ["token", "auth", "session", "yahoo"]
    },
    "ebay.com": {
      displayName: "eBay",
      cookiePatterns: ["nonsession", "dp1", "ebaysignin"],
      storageKeyPatterns: ["token", "auth", "session", "ebay"]
    },
    "discord.com": {
      displayName: "Discord",
      cookiePatterns: ["__dcfduid", "__sdcfduid", "locale"],
      storageKeyPatterns: ["token", "auth", "session", "discord"]
    },
    "twitch.tv": {
      displayName: "Twitch",
      cookiePatterns: ["auth-token", "login", "persistent"],
      storageKeyPatterns: ["token", "auth", "session", "twitch"]
    },
    "openai.com": {
      displayName: "OpenAI",
      cookiePatterns: ["__Secure-next-auth.session-token", "_puid", "oai-did"],
      storageKeyPatterns: ["token", "auth", "session", "openai"]
    },
    "atlassian.com": {
      displayName: "Atlassian",
      cookiePatterns: ["cloud.session.token", "atlassian.xsrf.token", "seraph.rememberme.cookie"],
      storageKeyPatterns: ["token", "auth", "session", "atlassian"]
    }
  };

  const root = typeof globalThis !== "undefined" ? globalThis : window;
  root.SESSION_SENTINEL_SITE_PATTERNS = patterns;
})();
