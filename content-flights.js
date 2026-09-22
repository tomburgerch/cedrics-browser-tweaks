// Cedric's Browser Tweaks — Google Flights Content Script
// Shows prices in a fixed currency (default USD) instead of the local one
// Google guesses from your IP (ISK in Iceland, CHF at home, ...), and
// remembers whichever currency you last picked in Flights' own footer picker.
//
// Google Flights reads the currency from the `curr=` query param and does NOT
// persist a choice across visits: opening Flights again drops `curr` and you
// are back to the local currency. So we keep the preference ourselves
// (`flights_currency` in chrome.storage.sync) and put it in the URL.
//
// Verified 2026-09-22: `curr=USD` switches every price on the page; the
// footer picker rewrites `curr=` in place (SPA, no reload); in-app searches
// carry `curr=` forward.

(function () {
  const DEFAULT_CURRENCY = "USD";
  const CURRENCY_RE = /^[A-Z]{3}$/;

  function currentCurr() {
    const c = new URLSearchParams(window.location.search).get("curr");
    return c && CURRENCY_RE.test(c.toUpperCase()) ? c.toUpperCase() : null;
  }

  function urlWithCurr(currency) {
    const url = new URL(window.location.href);
    url.searchParams.set("curr", currency);
    return url.toString();
  }

  // A page reached from inside Google Flights carries the currency the user is
  // already looking at; a page reached from outside (a shared link, a Google
  // Search result, a bookmark) may carry someone else's local currency.
  function cameFromFlights() {
    try {
      const ref = new URL(document.referrer);
      return /(^|\.)google\.[a-z.]+$/.test(ref.hostname) && ref.pathname.startsWith("/travel");
    } catch {
      return false;
    }
  }

  chrome.storage.sync.get(["flights_enabled", "flights_currency"], (settings) => {
    if (settings.flights_enabled === false) return;
    let preferred = CURRENCY_RE.test(settings.flights_currency || "")
      ? settings.flights_currency
      : DEFAULT_CURRENCY;

    const onLoad = currentCurr();
    if (onLoad !== preferred) {
      if (onLoad && cameFromFlights()) {
        // In-app navigation with an explicit currency: that is a choice.
        preferred = onLoad;
        chrome.storage.sync.set({ flights_currency: onLoad });
      } else {
        window.location.replace(urlWithCurr(preferred));
        return;
      }
    }

    // Watch for SPA URL changes (the isolated world cannot hook the page's
    // history API, so poll like the Windy script does).
    let lastSeen = preferred;
    setInterval(() => {
      const c = currentCurr();
      if (c === null) {
        // An in-app navigation dropped the param, so the page is back on the
        // local currency: reload with the preference (rare; searches keep it).
        window.location.replace(urlWithCurr(preferred));
        return;
      }
      if (c !== lastSeen) {
        // The user picked a currency in the footer picker: remember it.
        lastSeen = c;
        preferred = c;
        chrome.storage.sync.set({ flights_currency: c });
      }
    }, 1000);
  });
})();
