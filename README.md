# Cedric's Browser Tweaks

A Chrome extension (Manifest V3) with personalized enhancements for frequently used websites: a Focus Mode site blocker, YouTube playback-speed memory, Windy.com aviation weather preferences, and a fixed Google Flights currency.

## Features

### Focus Mode — Block Distracting Sites
- Toggle in the popup to block a curated list of time-sink sites (Instagram, Facebook, news sites, deal sites, etc.).
- Edit the list directly from the popup — add or remove domains; the list syncs across devices via `chrome.storage.sync` (`focusBlockedDomains`).
- Uses Chrome's `declarativeNetRequest` API for clean network-level blocking — blocked sites show `ERR_BLOCKED_BY_CLIENT`.
- Defaults seeded by `DEFAULT_BLOCKED_DOMAINS` in `background.js` on first install.
- **5-minute unlock cooldown:** turning Focus Mode *off* does not unblock immediately. Sites stay blocked for 5 minutes (tracked via `focusUnlockAt` and a `chrome.alarms` timer that flips `focusModeEnabled` off when it fires). The popup shows a cooldown panel with a **Cancel** button to abort the pending unlock. Re-locking (toggling back on) is instant and cancels any pending unlock.

### YouTube — Speed Saver
- Automatically sets your preferred playback speed on every YouTube video.
- Persists across page navigations, new tabs, and browser restarts (SPA-aware via a `MutationObserver`).
- Syncs your preference across devices via Chrome sync (`preferredSpeed`).
- Speeds: 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x (default: 2x).

### Windy.com — Aviation Weather Preferences
- Auto-redirects to your last viewed location (default: King Shaka / Durban FALE, `-29.602 / 31.130`).
- Auto-selects the Meteogram view for detailed aviation weather.
- Auto-enables the 1h forecast for hourly resolution.
- Remembers your location as you navigate (SPA-aware, with a redirect-loop guard).
- All features can be toggled on/off from the popup.

### Google Flights: Fixed Currency
- Shows prices in your currency (default **USD**) instead of the local one Google guesses from your IP (ISK in Iceland, CHF in Switzerland).
- Remembers the last currency you picked, either in Flights' own footer picker or in the extension popup (`flights_currency`, synced).
- How: Google Flights reads the `curr=` query param but never persists it, so `content-flights.js` adds your currency to every Flights URL. A link from outside Flights that carries another currency is rewritten to yours; a currency you choose inside Flights becomes the new default.
- Toggle it off in the popup (`flights_enabled`).

## Tech Stack

- Plain JavaScript Chrome extension, **Manifest V3** — no build step, no dependencies.
- APIs: `declarativeNetRequest` (Focus Mode blocking), `chrome.storage.sync` (cross-device preferences), `chrome.alarms` (unlock cooldown).
- Permissions: `storage`, `declarativeNetRequest`, `alarms`. Host permissions: `*://*.youtube.com/*`, `*://*.windy.com/*`.

## Project Structure

- `manifest.json` — extension manifest (permissions, content-script matches, background service worker).
- `background.js` — Focus Mode service worker: manages dynamic `declarativeNetRequest` block rules and the unlock-cooldown alarm.
- `content-youtube.js` — applies preferred playback speed on YouTube.
- `content-windy.js` — applies Windy.com location / meteogram / 1h-forecast preferences.
- `content-flights.js` — keeps Google Flights on your preferred currency.
- `popup.html` / `popup.js` — toolbar popup UI for configuring all four features.
- `icons/` — extension icons (16/48/128, plus source `icon.svg`).
- `docs/superpowers/` — design specs (`specs/`) and implementation plans (`plans/`), e.g. the Windy preferences design.

## Installation

1. Clone this repo.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. The extension is now active on YouTube and Windy.com.

There is no build or test step — it loads directly as an unpacked extension.

## Usage

Click the extension icon in the toolbar to configure preferences for each site: set your YouTube playback speed, toggle and edit the Focus Mode block list, enable/disable the Windy.com tweaks, and pick the Google Flights currency.
