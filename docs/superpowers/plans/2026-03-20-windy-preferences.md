# Windy Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windy.com preference persistence (auto-meteogram, auto-1h-forecast, default location) to the existing Chrome extension, rebranded as a multi-site tool.

**Architecture:** Content script per site, shared popup with per-site sections, chrome.storage.sync for persistence. Windy module uses URL redirects for location/view and DOM manipulation for the 1h forecast toggle. sessionStorage guards prevent redirect loops.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JavaScript, chrome.storage.sync, MutationObserver

**Spec:** `docs/superpowers/specs/2026-03-20-windy-preferences-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `manifest.json` | Modify | Rebrand, add Windy host permission, add content-windy.js entry, rename content.js ref |
| `content.js` → `content-youtube.js` | Rename | YouTube speed saver (logic unchanged) |
| `content-windy.js` | Create | Windy preferences: redirect, meteogram, 1h forecast, location tracking |
| `popup.html` | Modify | Add Windy settings section below YouTube section |
| `popup.js` | Modify | Add Windy toggle handlers |
| `README.md` | Modify | Update to reflect multi-site extension |

No test framework — this is a plain Chrome extension with no build step. Testing is manual via loading unpacked in Chrome and verifying on windy.com and youtube.com.

---

### Task 1: Rebrand and Restructure Manifest

**Files:**
- Rename: `content.js` → `content-youtube.js`
- Modify: `manifest.json`

- [ ] **Step 1: Rename content.js to content-youtube.js**

```bash
cd /Users/tommyhawk/code/youtube-chrome-2x-plugin
mv content.js content-youtube.js
```

- [ ] **Step 2: Update manifest.json**

Replace entire `manifest.json` with:

```json
{
  "manifest_version": 3,
  "name": "Cedric's Browser Tweaks",
  "version": "2.0.0",
  "description": "Personalized browser enhancements: YouTube speed memory, Windy.com aviation weather preferences.",
  "permissions": ["storage"],
  "host_permissions": [
    "*://*.youtube.com/*",
    "*://*.windy.com/*"
  ],
  "content_scripts": [
    {
      "matches": ["*://*.youtube.com/*"],
      "js": ["content-youtube.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["*://*.windy.com/*"],
      "js": ["content-windy.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 3: Verify YouTube still works**

1. Open `chrome://extensions/`
2. Click reload on the extension
3. Open a YouTube video — speed should still be applied

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: rebrand to Cedric's Browser Tweaks, rename content.js"
```

---

### Task 2: Create Windy Content Script — URL Redirect Logic

**Files:**
- Create: `content-windy.js`

- [ ] **Step 1: Create content-windy.js with redirect logic**

```javascript
// Cedric's Browser Tweaks — Windy.com Content Script
// Auto-applies preferred settings: default location, meteogram view, 1h forecast.

(function () {
  const DEFAULTS = {
    lat: -33.759,
    lng: 18.548,
    zoom: 10,
  };

  // --- Redirect Loop Guard ---
  const REDIRECT_FLAG = "windy_tweaks_redirected";

  function wasRecentlyRedirected() {
    return sessionStorage.getItem(REDIRECT_FLAG) === "1";
  }

  function markRedirected() {
    sessionStorage.setItem(REDIRECT_FLAG, "1");
  }

  // Clean up redirect flag on the destination page so that future
  // homepage visits within the same tab session still redirect.
  // (The pre-redirect page's setTimeout is lost during navigation.)
  if (wasRecentlyRedirected()) {
    setTimeout(() => sessionStorage.removeItem(REDIRECT_FLAG), 5000);
  }

  function buildMeteogramUrl(lat, lng, zoom) {
    return `https://www.windy.com/${lat}/${lng}/meteogram?${lat},${lng},${zoom}`;
  }

  // --- URL Detection ---
  const COORD_REGEX = /^\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/;
  const pathname = window.location.pathname;

  const isBareHomepage = /^\/?$/.test(pathname);
  const isAirportPage = pathname.startsWith("/airport/");
  const coordMatch = pathname.match(COORD_REGEX);
  const hasMeteogram = pathname.includes("/meteogram");

  // --- Behavior 1: Default Location Redirect ---
  function handleHomepageRedirect(settings) {
    if (!isBareHomepage) return;
    if (wasRecentlyRedirected()) return;
    if (settings.windy_autoRedirect === false) return;

    const lat = settings.windy_lastLat || settings.windy_defaultLat || DEFAULTS.lat;
    const lng = settings.windy_lastLng || settings.windy_defaultLng || DEFAULTS.lng;

    markRedirected();
    window.location.replace(buildMeteogramUrl(lat, lng, DEFAULTS.zoom));
  }

  // --- Behavior 2: Ensure Meteogram View ---
  function handleMeteogramRedirect(settings) {
    if (!coordMatch || hasMeteogram || isAirportPage) return;
    if (wasRecentlyRedirected()) return;
    if (settings.windy_autoMeteogram === false) return;

    const newPathname = pathname.replace(
      /^\/(-?\d+\.?\d*)\/(-?\d+\.?\d*)/,
      "/$1/$2/meteogram"
    );
    const newUrl = window.location.origin + newPathname + window.location.search;

    markRedirected();
    window.location.replace(newUrl);
  }

  // --- Init ---
  chrome.storage.sync.get(
    [
      "windy_autoRedirect",
      "windy_autoMeteogram",
      "windy_auto1hForecast",
      "windy_defaultLat",
      "windy_defaultLng",
      "windy_lastLat",
      "windy_lastLng",
    ],
    (settings) => {
      handleHomepageRedirect(settings);
      handleMeteogramRedirect(settings);
    }
  );
})();
```

- [ ] **Step 2: Verify redirect works**

1. Reload extension in `chrome://extensions/`
2. Navigate to `windy.com` — should redirect to `windy.com/-33.759/18.548/meteogram?...`
3. Navigate to `windy.com/-33.759/18.548` (no meteogram) — should redirect to add `/meteogram`
4. Navigate to `windy.com/airport/ZA-0120` — should NOT redirect

- [ ] **Step 3: Commit**

```bash
git add content-windy.js
git commit -m "feat(windy): add URL redirect logic for default location and meteogram"
```

---

### Task 3: Add 1h Forecast Auto-Toggle

**Files:**
- Modify: `content-windy.js`

- [ ] **Step 1: Add 1h forecast observer after the redirect logic**

In `content-windy.js`, find the `// --- Init ---` section (the `chrome.storage.sync.get(...)` block and everything below it, up to but NOT including the closing `})();`). Replace ONLY that Init block with the code below. Keep all function definitions above it (`handleHomepageRedirect`, `handleMeteogramRedirect`, `buildMeteogramUrl`, etc.) intact:

```javascript
  // --- Behavior 3: Auto-Enable 1h Forecast ---
  function enable1hForecast() {
    const TIMEOUT_MS = 15000;
    let done = false;

    function tryEnable() {
      const checkboxes = document.querySelectorAll("div.checkbox.noselect");
      for (const cb of checkboxes) {
        if (cb.textContent.includes("1h forecast")) {
          if (cb.classList.contains("checkbox--off")) {
            cb.click();
          }
          done = true;
          return true;
        }
      }
      return false;
    }

    // Try immediately first
    if (tryEnable()) return;

    // Watch for the panel to appear
    const observeRoot = document.querySelector(".bottom-area") || document.body;
    const observer = new MutationObserver(() => {
      if (done) return;
      if (tryEnable()) {
        observer.disconnect();
      }
    });

    observer.observe(observeRoot, { childList: true, subtree: true });

    // Safety timeout — disconnect after 15s regardless
    setTimeout(() => {
      if (!done) observer.disconnect();
    }, TIMEOUT_MS);
  }

  // --- Init ---
  chrome.storage.sync.get(
    [
      "windy_autoRedirect",
      "windy_autoMeteogram",
      "windy_auto1hForecast",
      "windy_defaultLat",
      "windy_defaultLng",
      "windy_lastLat",
      "windy_lastLng",
    ],
    (settings) => {
      // Redirects return early (page reloads), so only one fires
      handleHomepageRedirect(settings);
      handleMeteogramRedirect(settings);

      // 1h forecast applies on pages that don't redirect
      if (settings.windy_auto1hForecast !== false) {
        enable1hForecast();
      }
    }
  );
```

This replaces the previous simpler Init block.

- [ ] **Step 2: Verify 1h forecast toggle**

1. Reload extension
2. Navigate to `windy.com/-33.759/18.548/meteogram?-33.759,18.548,10`
3. The bottom panel should show hourly increments (1, 2, 3, 4...) not 3-hour (5, 8, 11, 14...)
4. Navigate to `windy.com/airport/ZA-0120` — scroll to meteogram, 1h forecast should also auto-enable

- [ ] **Step 3: Commit**

```bash
git add content-windy.js
git commit -m "feat(windy): auto-enable 1h forecast via MutationObserver"
```

---

### Task 4: Add SPA Location Tracking

**Files:**
- Modify: `content-windy.js`

- [ ] **Step 1: Add history monkey-patching and location save**

Insert after the `// --- URL Detection ---` section (which defines `COORD_REGEX`, `pathname`, `isBareHomepage`, etc.) and before the `// --- Behavior 1 ---` section. `COORD_REGEX` is already defined above, so we reuse it:

```javascript
  // --- SPA Navigation Tracking ---
  function saveLocationFromUrl() {
    const match = window.location.pathname.match(COORD_REGEX);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      chrome.storage.sync.set({ windy_lastLat: lat, windy_lastLng: lng });
    }
  }

  // Monkey-patch history methods to detect SPA navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    saveLocationFromUrl();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    saveLocationFromUrl();
  };

  window.addEventListener("popstate", saveLocationFromUrl);

  // Save initial location
  saveLocationFromUrl();
```

- [ ] **Step 2: Verify location persistence**

1. Reload extension
2. Navigate to Morningstar on Windy, then pan the map or search for another location (e.g., Stellenbosch)
3. Open a new tab, go to `windy.com` — should redirect to the last viewed coordinates, not Morningstar
4. Inspect via: right-click extension icon → Inspect popup → Console → `chrome.storage.sync.get(null, console.log)` to verify `windy_lastLat` / `windy_lastLng` are saved

- [ ] **Step 3: Commit**

```bash
git add content-windy.js
git commit -m "feat(windy): track location via history monkey-patching"
```

---

### Task 5: Update Popup UI

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`

- [ ] **Step 1: Update popup.html**

Replace entire file with:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 260px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px;
      background: #1a1a1a;
      color: #e8e8e8;
    }
    h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #fff;
    }
    .section {
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid #333;
    }
    .section:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .section-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 8px;
    }
    .speed-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .speed-btn {
      padding: 8px 0;
      border: 1px solid #444;
      border-radius: 6px;
      background: #2a2a2a;
      color: #ccc;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
    }
    .speed-btn:hover {
      background: #383838;
      border-color: #666;
    }
    .speed-btn.active {
      background: #cc0000;
      border-color: #cc0000;
      color: #fff;
      font-weight: 700;
    }
    .status {
      font-size: 11px;
      color: #888;
      text-align: center;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 0;
    }
    .toggle-label {
      font-size: 13px;
      color: #ccc;
    }
    .toggle {
      position: relative;
      width: 36px;
      height: 20px;
      flex-shrink: 0;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      inset: 0;
      background: #444;
      border-radius: 20px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toggle-slider::before {
      content: "";
      position: absolute;
      height: 14px;
      width: 14px;
      left: 3px;
      bottom: 3px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle input:checked + .toggle-slider {
      background: #cc0000;
    }
    .toggle input:checked + .toggle-slider::before {
      transform: translateX(16px);
    }
  </style>
</head>
<body>
  <div class="section">
    <div class="section-label">YouTube</div>
    <h2>Playback Speed</h2>
    <div class="speed-grid">
      <button class="speed-btn" data-speed="1">1x</button>
      <button class="speed-btn" data-speed="1.25">1.25x</button>
      <button class="speed-btn" data-speed="1.5">1.5x</button>
      <button class="speed-btn" data-speed="1.75">1.75x</button>
      <button class="speed-btn" data-speed="2">2x</button>
      <button class="speed-btn" data-speed="2.5">2.5x</button>
    </div>
    <div class="status" id="yt-status">Loading...</div>
  </div>

  <div class="section">
    <div class="section-label">Windy.com</div>
    <div class="toggle-row">
      <span class="toggle-label">Auto-redirect to last location</span>
      <label class="toggle">
        <input type="checkbox" id="windy-redirect" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="toggle-row">
      <span class="toggle-label">Auto-meteogram view</span>
      <label class="toggle">
        <input type="checkbox" id="windy-meteogram" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
    <div class="toggle-row">
      <span class="toggle-label">Auto 1h forecast</span>
      <label class="toggle">
        <input type="checkbox" id="windy-1h" checked>
        <span class="toggle-slider"></span>
      </label>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Update popup.js**

Replace entire file with:

```javascript
// Cedric's Browser Tweaks — Popup Script

// --- YouTube Section ---
const DEFAULT_SPEED = 2.0;
const buttons = document.querySelectorAll(".speed-btn");
const ytStatus = document.getElementById("yt-status");

chrome.storage.sync.get("preferredSpeed", (result) => {
  const speed = result.preferredSpeed || DEFAULT_SPEED;
  highlightActive(speed);
  ytStatus.textContent = `Speed: ${speed}x (saved)`;
});

buttons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const speed = parseFloat(btn.dataset.speed);
    chrome.storage.sync.set({ preferredSpeed: speed }, () => {
      highlightActive(speed);
      ytStatus.textContent = `Speed: ${speed}x (saved)`;
    });
  });
});

function highlightActive(speed) {
  buttons.forEach((btn) => {
    btn.classList.toggle("active", parseFloat(btn.dataset.speed) === speed);
  });
}

// --- Windy Section ---
const windyToggles = {
  "windy-redirect": "windy_autoRedirect",
  "windy-meteogram": "windy_autoMeteogram",
  "windy-1h": "windy_auto1hForecast",
};

// Load saved states
chrome.storage.sync.get(
  Object.values(windyToggles),
  (result) => {
    for (const [elementId, storageKey] of Object.entries(windyToggles)) {
      const el = document.getElementById(elementId);
      // Default to true if not set
      el.checked = result[storageKey] !== false;
    }
  }
);

// Save on toggle
for (const [elementId, storageKey] of Object.entries(windyToggles)) {
  const el = document.getElementById(elementId);
  el.addEventListener("change", () => {
    chrome.storage.sync.set({ [storageKey]: el.checked });
  });
}
```

- [ ] **Step 3: Verify popup**

1. Reload extension
2. Click the extension icon — should show YouTube speed buttons AND Windy toggles
3. Toggle a Windy switch off and on — verify it saves (reopen popup to confirm)
4. Click a YouTube speed button — verify it still works

- [ ] **Step 4: Commit**

```bash
git add popup.html popup.js
git commit -m "feat: update popup with Windy preferences section"
```

---

### Task 6: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md**

```markdown
# Cedric's Browser Tweaks

A Chrome extension with personalized enhancements for frequently used websites.

## Features

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for multi-site extension"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Full reload and YouTube test**

1. Go to `chrome://extensions/`, click reload
2. Open a YouTube video — verify speed is applied automatically
3. Open popup — verify speed buttons work

- [ ] **Step 2: Windy homepage redirect test**

1. Open `windy.com` in a new tab
2. Should redirect to `windy.com/-33.759/18.548/meteogram?...`
3. Bottom panel should show hourly increments (1h forecast auto-enabled)

- [ ] **Step 3: Windy meteogram injection test**

1. Navigate to `windy.com/-33.759/18.548` (no meteogram in path)
2. Should redirect to add `/meteogram`

- [ ] **Step 4: Windy airport page test**

1. Navigate to `windy.com/airport/ZA-0120`
2. Should NOT redirect, but 1h forecast should auto-enable in the airport meteogram

- [ ] **Step 5: Location persistence test**

1. From the meteogram view, search for and navigate to Stellenbosch
2. Close the tab
3. Open a new tab, go to `windy.com`
4. Should redirect to Stellenbosch coordinates, not Morningstar

- [ ] **Step 6: Toggle disable test**

1. Open popup, disable "Auto-redirect to last location"
2. Open `windy.com` in a new tab — should stay on the homepage, not redirect

- [ ] **Step 7: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix: adjustments from end-to-end testing"
```
