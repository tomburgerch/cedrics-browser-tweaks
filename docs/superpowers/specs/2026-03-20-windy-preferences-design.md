# Windy Preferences — Chrome Extension Design

## Overview

Extend the existing YouTube Speed Saver Chrome extension into a general-purpose "Cedric's Browser Tweaks" extension. The first new module adds Windy.com preference persistence for aviation weather checking.

## Problem

Windy.com resets user preferences on every visit. For a pilot checking weather before flights, this means manually repeating the same steps each time:
1. Search for an airfield
2. Open the detailed forecast view
3. Switch to the Meteogram tab
4. Enable the 1h forecast toggle

## Solution

A content script that auto-applies preferred Windy settings on page load, reducing the manual flow to zero clicks.

## Architecture

### Extension Rebranding

- Rename from "YouTube Speed Saver" to "Cedric's Browser Tweaks"
- Modular content scripts per site:
  - `content-youtube.js` — existing YouTube speed saver (unchanged)
  - `content-windy.js` — new Windy preferences
  - `popup.html` / `popup.js` — updated with sections for both sites

### Manifest Changes

- Update `name` and `description`
- Add `*://*.windy.com/*` to `host_permissions`
- Add second `content_scripts` entry:
  ```json
  {
    "matches": ["*://*.windy.com/*"],
    "js": ["content-windy.js"],
    "run_at": "document_idle"
  }
  ```

### Windy Content Script (`content-windy.js`)

Three behaviors, executed on page load:

#### 1. Default Location Redirect

- Detects if the user landed on the bare Windy homepage (`windy.com/` with no coordinates or airport path)
- Redirects to the saved location with meteogram view using `window.location.replace()`
- Default location: Morningstar Airfield (`-33.759/18.548`)
- Default URL: `https://www.windy.com/-33.759/18.548/meteogram?-33.759,18.548,10`

#### 2. Ensure Meteogram View

- If the URL contains coordinates but doesn't include `/meteogram` in the path, inject it and redirect
- Example: `windy.com/-33.759/18.548?...` becomes `windy.com/-33.759/18.548/meteogram?...`
- Only applies to the detailed forecast view URLs (coordinate-based paths), not airport pages (`/airport/...`)

#### 3. Auto-Enable 1h Forecast

- Uses a `MutationObserver` to watch for the bottom panel tabs to render
- Finds the "1h forecast" checkbox by walking text nodes for "1h forecast"
- The checkbox is a `div.checkbox.noselect` element (Svelte component)
- State detection: no modifier class = ON, `checkbox--off` class = OFF
- If OFF, clicks it to enable
- Observer disconnects after successful toggle to avoid re-triggering
- Includes retry logic with short delays since the panel renders asynchronously

#### 4. Location Tracking (SPA-aware)

- Windy is a single-page app — URL changes without page reloads
- `setInterval` every 2 seconds checks `window.location.href`
- When coordinates change, extracts lat/lng from the URL path pattern `windy.com/{lat}/{lng}/...`
- Saves to `chrome.storage.sync` so the next visit remembers the last location

### Popup UI Updates

Sectioned layout:

**YouTube section:**
- Speed slider/selector (existing, unchanged)

**Windy section:**
- Auto-meteogram toggle (on by default)
- Auto 1h forecast toggle (on by default)
- Current default location display (e.g., "Morningstar Airfield")

### Storage Schema

```
chrome.storage.sync:
  preferredSpeed: number          // existing YouTube speed
  windy_defaultLat: number        // default -33.759
  windy_defaultLng: number        // default 18.548
  windy_defaultName: string       // default "Morningstar Airfield"
  windy_autoMeteogram: boolean    // default true
  windy_auto1hForecast: boolean   // default true
  windy_lastLat: number           // last viewed latitude
  windy_lastLng: number           // last viewed longitude
```

## Key Technical Decisions

- **URL-based redirect over DOM manipulation for location/view**: The meteogram view is encoded in the URL path (`/meteogram`), so a redirect is cleaner than clicking tabs
- **DOM click for 1h forecast**: This toggle is not URL-encoded, so DOM interaction is required
- **`setInterval` over `popstate`/`hashchange`**: Windy uses custom SPA navigation that doesn't always fire standard history events
- **No build step**: Plain JS files, consistent with the existing YouTube extension
- **`chrome.storage.sync`**: Settings persist across devices if the user is signed into Chrome

## Future Iterations

- Favorite airports bar: Quick-access buttons for Morningstar, Stellenbosch, Cape Town International (and user-configurable additions)
- Each button navigates to `windy.com/{lat}/{lng}/meteogram` with a single click

## URL Reference

| View | URL Pattern |
|------|-------------|
| Homepage | `windy.com/` |
| Airport page | `windy.com/airport/ZA-0120?{lat},{lng},{zoom}` |
| Detailed forecast (basic) | `windy.com/{lat}/{lng}?{viewLat},{viewLng},{zoom}` |
| Detailed forecast (meteogram) | `windy.com/{lat}/{lng}/meteogram?{viewLat},{viewLng},{zoom}` |

## DOM Reference

| Element | Selector | Notes |
|---------|----------|-------|
| 1h forecast checkbox | `div.checkbox.noselect` containing text "1h forecast" | `checkbox--off` class = disabled, no modifier = enabled |
| Meteogram tab | Bottom bar tab with text "Meteogram" | Clicking changes URL to include `/meteogram` |
| Search bar | `input[type="text"][placeholder="Search..."]` | Top-left |
