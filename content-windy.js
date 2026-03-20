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
})();
