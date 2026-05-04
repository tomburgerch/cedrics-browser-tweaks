# Cedric's Browser Tweaks

A Chrome extension with personalized enhancements for frequently used websites.

## Features

### Focus Mode — Block Distracting Sites
- Toggle in the popup to block a curated list of time-sink sites (Instagram, Facebook, news sites, deal sites, etc.)
- Uses Chrome's `declarativeNetRequest` API for clean network-level blocking — blocked sites show `ERR_BLOCKED_BY_CLIENT`
- Master on/off only for now; per-site toggles and time-of-day rules can be added later
- The blocked-domain list lives in `background.js` (`BLOCKED_DOMAINS`) and `popup.js` (`FOCUS_SITES`) — keep them in sync

### YouTube — Speed Saver
- Automatically sets your preferred playback speed on every YouTube video
- Persists across page navigations, new tabs, and browser restarts
- Syncs your preference across devices via Chrome sync
- Speeds: 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x (default: 2x)

### Windy.com — Aviation Weather Preferences
- Auto-redirects to your last viewed location (default: Morningstar Airfield)
- Auto-selects the Meteogram view for detailed aviation weather
- Auto-enables the 1h forecast for hourly resolution
- Remembers your location as you navigate (SPA-aware)
- All features can be toggled on/off from the popup

## Installation

1. Clone this repo
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** and select the project folder
5. The extension is now active on YouTube and Windy.com

## Usage

Click the extension icon in the toolbar to configure preferences for each site.
