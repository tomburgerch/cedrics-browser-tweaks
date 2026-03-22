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
- Rename `content.js` to `content-youtube.js` (update manifest reference)
- Modular content scripts per site:
  - `content-youtube.js` — existing YouTube speed saver (unchanged logic)
  - `content-windy.js` — new Windy preferences
  - `popup.html` / `popup.js` — updated with sections for both sites
- Bump version to `2.0.0`

### Manifest Changes

- Update `name` and `description`
- Add `*://*.windy.com/*` to `host_permissions`
- Rename `content.js` reference to `content-youtube.js`
- Add second `content_scripts` entry:
  ```json
  {
    "matches": ["*://*.windy.com/*"],
    "js": ["content-windy.js"],
    "run_at": "document_idle"
  }
  ```

### Windy Content Script (`content-windy.js`)

Three behaviors, executed on page load. A `redirected` flag in `sessionStorage` prevents redirect loops — set before any redirect, checked before attempting one.

#### URL Pattern Decision Matrix

| URL Pattern | Redirect to last location? | Inject /meteogram? | Auto 1h forecast? | Track location? |
|---|---|---|---|---|
| Bare homepage (`windy.com/`) | Yes | N/A (redirect includes it) | N/A | No |
| Coordinate, no `/meteogram` | No | Yes | N/A (redirect includes it) | Yes |
| Coordinate, with `/meteogram` | No | No | Yes | Yes |
| Airport page (`/airport/...`) | No | No | Yes (in airport meteogram) | No |

#### 1. Default Location Redirect

- **Detection**: Pathname is exactly `/` or empty (regex: `^\/?\s*$`)
- **Redirect target**: Uses `windy_lastLat/windy_lastLng` if saved, falls back to `windy_defaultLat/windy_defaultLng` (Morningstar Airfield: `-33.759/18.548`)
- **Redirect URL**: `https://www.windy.com/{lat}/{lng}/meteogram?{lat},{lng},10`
- Uses `window.location.replace()` to avoid polluting browser history
- **Loop guard**: Sets `sessionStorage.setItem('windy_redirected', '1')` before redirecting. On load, skips redirect if this flag is set. Flag is cleared after 5 seconds via `setTimeout` so subsequent manual homepage visits still redirect.

#### 2. Ensure Meteogram View

- **Detection**: URL pathname matches coordinate pattern (`/^\/\-?\d+\.\d+\/\-?\d+\.\d+$/` — two decimal numbers) but does NOT contain `/meteogram`
- Does NOT apply to airport pages (`/airport/...`) or other paths
- Inserts `/meteogram` after the coordinate segment and redirects
- **Loop guard**: Same `sessionStorage` flag as above

#### 3. Auto-Enable 1h Forecast

- Uses a `MutationObserver` on the closest stable parent of the bottom panel (target: an element matching `.bottom-area` or `document.body` as fallback), with `{ childList: true, subtree: true }`
- On each mutation, searches for the "1h forecast" checkbox by finding all `div.checkbox.noselect` elements and checking their text content
- State detection: `checkbox--off` class present = OFF, absent = ON
- If OFF, calls `.click()` on the checkbox element
- **Timeout**: Observer disconnects after 15 seconds regardless of success, to prevent resource waste on Windy's constantly-updating map DOM
- **Applies to both** detailed forecast and airport page views (the 1h toggle appears in both)

#### 4. Location Tracking (SPA-aware)

- Monkey-patches `history.pushState` and `history.replaceState` to fire a custom `windy-url-change` event, plus listens for `popstate`
- On URL change, extracts lat/lng from the pathname using regex `/^\/-?\d+\.?\d*\/-?\d+\.?\d*/`
- Saves coordinates to `chrome.storage.sync` as `windy_lastLat` / `windy_lastLng`
- Only saves for coordinate-based URLs, not airport pages

### Popup UI Updates

Sectioned layout:

**YouTube section:**
- Speed slider/selector (existing, unchanged)

**Windy section:**
- Auto-redirect toggle (on by default) — controls homepage redirect
- Auto-meteogram toggle (on by default)
- Auto 1h forecast toggle (on by default)

### Storage Schema

```
chrome.storage.sync:
  preferredSpeed: number            // existing YouTube speed
  windy_defaultLat: number          // default -33.759 (Morningstar)
  windy_defaultLng: number          // default 18.548
  windy_autoRedirect: boolean       // default true
  windy_autoMeteogram: boolean      // default true
  windy_auto1hForecast: boolean     // default true
  windy_lastLat: number             // last viewed latitude
  windy_lastLng: number             // last viewed longitude
```

## Key Technical Decisions

- **URL-based redirect over DOM manipulation for location/view**: The meteogram view is encoded in the URL path (`/meteogram`), so a redirect is cleaner than clicking tabs
- **DOM click for 1h forecast**: This toggle is not URL-encoded, so DOM interaction is required
- **`sessionStorage` redirect guard**: Prevents infinite redirect loops when the content script re-executes after a redirect
- **`history.pushState/replaceState` monkey-patching over `setInterval`**: More responsive and less wasteful than polling; fires immediately on SPA navigation
- **No build step**: Plain JS files, consistent with the existing YouTube extension
- **`chrome.storage.sync`**: Settings persist across devices if the user is signed into Chrome
- **MutationObserver with 15s timeout**: Prevents resource waste on Windy's complex, constantly-updating map DOM

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
| Bottom panel area | `.bottom-area` or similar | Observation root for MutationObserver |
