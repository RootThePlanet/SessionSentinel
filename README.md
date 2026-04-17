# SessionSentinel

Browser extension prototype that monitors session token and authentication cookie behavior across browsing sessions.

## Current capabilities

- Detects suspicious auth token behavior in cookies and `localStorage`
- Alerts on:
  - frequent unexpected token changes
  - previously seen token replay patterns
  - concurrent cookie token use across multiple browser stores
- Includes configurable alert sensitivity (`high`, `medium`, `low`)
- Maps common session storage patterns for popular platforms (GitHub, Google, Facebook, X/Twitter, Amazon, Microsoft)

## Prototype usage

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this repository folder
4. Open the extension **Options** page to configure sensitivity
5. Use the popup to review recent anomaly alerts
