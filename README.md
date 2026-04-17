# SessionSentinel

Browser extension that monitors session tokens and authentication cookies to detect suspicious account activity — including session hijacking, token replay attacks, and concurrent session usage across browser profiles.

Works on **Chrome** (Manifest V3) and **Firefox** (Manifest V2).

## Features

### Security Monitoring
- **Token change detection** — alerts on frequent, unexpected session token or auth cookie mutations
- **Replay detection** — flags when a previously observed token value reappears
- **Concurrent session detection** — identifies the same cookie token appearing across multiple browser cookie stores
- **Per-site monitoring** — built-in patterns for GitHub, Google, Facebook, X/Twitter, Amazon, and Microsoft
- **Custom site patterns** — add your own domains with specific cookie names and localStorage keys to watch
- **Configurable sensitivity** — high, medium, and low thresholds for alert frequency

### User Experience
- **Modern popup UI** — dark/light theme support, severity filter tabs, search, relative timestamps
- **Alert management** — dismiss individual alerts, clear all, or export as JSON
- **Badge count** — unread alert count on the extension icon with severity-colored background
- **Browser notifications** — desktop alerts for high-severity events
- **Quick toggle** — pause/resume monitoring directly from the popup
- **Settings import/export** — back up and restore your configuration
- **Accessibility** — ARIA labels, keyboard navigation, screen reader friendly

## Installation

### Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this repository folder
4. The extension uses `manifest.json` (Manifest V3)

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.firefox.json` from this repository folder
4. For permanent installation, rename `manifest.firefox.json` to `manifest.json`

## Configuration

Open the extension **Settings** page to:
- Toggle monitoring on/off
- Enable/disable browser notifications for high-severity alerts
- Set alert sensitivity (high, medium, low)
- Choose a theme (system, light, dark)
- Add custom site patterns for domain-specific token monitoring
- Export/import settings or reset all data

## Architecture

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome Manifest V3 configuration |
| `manifest.firefox.json` | Firefox Manifest V2 configuration |
| `browserApi.js` | Cross-browser API abstraction (`chrome.*` / `browser.*`) |
| `constants.js` | Shared constants, message types, and default settings |
| `sitePatterns.js` | Built-in session token patterns for popular sites |
| `background.js` | Core monitoring engine — cookie listener, token hashing, alert pipeline, badge, notifications |
| `content.js` | Content script — polls `localStorage` for session tokens and sends snapshots to background |
| `popup.html` / `popup.js` | Extension popup — alert list with search, filters, dismiss, export |
| `options.html` / `options.js` | Settings page — monitoring config, custom patterns, data management |
| `icons/` | Extension icons (16px, 48px, 128px) |

## How It Works

1. **Cookie monitoring**: The background script listens for cookie changes via `cookies.onChanged` and checks if the cookie name matches known session token patterns
2. **localStorage monitoring**: A content script scans `localStorage` on page load and polls every 30 seconds, sending matching entries to the background script
3. **Token analysis**: Each observed token value is SHA-256 hashed and tracked over time. The engine detects rapid changes, value replays, and cross-store usage
4. **Alerting**: When suspicious patterns are detected, alerts are stored and the extension badge updates. High-severity alerts trigger browser notifications

## Cross-Browser Compatibility

The extension uses a lightweight API abstraction layer (`browserApi.js`) that detects the runtime environment:

- **Chrome**: Uses `chrome.*` APIs with MV3 service worker
- **Firefox**: Uses `browser.*` Promise-based APIs with MV2 background scripts

## Security Notes

- Token values are **never stored in plaintext** — only SHA-256 hashes are persisted
- All monitoring data stays local in `chrome.storage.local` / `browser.storage.local`
- No external network requests are made
- The extension requires `<all_urls>` host permission to monitor cookies across all sites
