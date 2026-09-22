// Cedric's Browser Tweaks — Popup Script

import { getEffectiveDomains } from "./focus-defaults.js";

// --- Focus Mode Section ---
// The blocked-domain list is stored in chrome.storage.sync under
// `focusBlockedDomains`. The service worker (background.js) seeds defaults on
// install and re-syncs declarativeNetRequest rules whenever the list changes.
// Unlocking is gated by a 5-minute cooldown (`focusUnlockAt`) that the
// service worker enforces via a chrome.alarms timer.
//
// IMPORTANT: when `focusBlockedDomains` is not yet a usable array (e.g. a
// freshly synced profile where onInstalled's seed has not run), we fall back
// to the SAME defaults the blocker uses (via getEffectiveDomains) instead of
// an empty list. Otherwise the popup would show "(no sites)" while the blocker
// enforces the defaults, and the first "add" would persist a 1-element array
// that clobbers those enforced defaults.

const UNLOCK_COOLDOWN_MS = 5 * 60 * 1000;

const focusToggle = document.getElementById("focus-mode");
const focusList = document.getElementById("focus-site-list");
const focusAddInput = document.getElementById("focus-add-input");
const focusAddBtn = document.getElementById("focus-add-btn");
const focusAddError = document.getElementById("focus-add-error");
const cooldownPanel = document.getElementById("focus-cooldown");
const countdownEl = document.getElementById("focus-countdown");
const cancelBtn = document.getElementById("focus-cancel");

let blockedDomains = [];
let countdownTimer = null;

function normalizeDomain(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
}

function isValidDomain(d) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d);
}

function renderDomains() {
  focusList.innerHTML = "";
  if (blockedDomains.length === 0) {
    const li = document.createElement("li");
    li.textContent = "(no sites — add one below)";
    li.style.color = "#666";
    li.style.justifyContent = "center";
    focusList.appendChild(li);
    return;
  }
  for (const domain of blockedDomains) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "domain";
    span.textContent = domain;
    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "×";
    btn.title = `Remove ${domain}`;
    btn.addEventListener("click", () => removeDomain(domain));
    li.append(span, btn);
    focusList.appendChild(li);
  }
}

function saveDomains() {
  chrome.storage.sync.set({ focusBlockedDomains: blockedDomains });
}

function removeDomain(domain) {
  blockedDomains = blockedDomains.filter((d) => d !== domain);
  renderDomains();
  saveDomains();
}

function addDomain() {
  focusAddError.textContent = "";
  const raw = focusAddInput.value;
  if (!raw.trim()) return;
  const normalized = normalizeDomain(raw);
  if (!isValidDomain(normalized)) {
    focusAddError.textContent = "Not a valid domain.";
    return;
  }
  if (blockedDomains.includes(normalized)) {
    focusAddError.textContent = "Already in the list.";
    return;
  }
  blockedDomains = [...blockedDomains, normalized];
  focusAddInput.value = "";
  renderDomains();
  saveDomains();
}

focusAddBtn.addEventListener("click", addDomain);
focusAddInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addDomain();
});

function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function renderFocusState({ focusModeEnabled, focusUnlockAt }) {
  const enabled = focusModeEnabled === true;
  const cooling = enabled && typeof focusUnlockAt === "number" && focusUnlockAt > Date.now();

  // During cooldown sites are still blocked, so the toggle stays ON.
  // The cooldown panel below exposes Cancel as the only way to act on it.
  focusToggle.checked = enabled;
  focusToggle.disabled = cooling;
  cooldownPanel.classList.toggle("visible", cooling);

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  if (cooling) {
    const tick = () => {
      const remaining = focusUnlockAt - Date.now();
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        return;
      }
      countdownEl.textContent = formatCountdown(remaining);
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
}

async function loadFocusState() {
  // Use the same effective-list resolution as the blocker so the UI never
  // disagrees with what is actually enforced (falls back to defaults when the
  // stored value is not yet a usable array).
  blockedDomains = await getEffectiveDomains();
  renderDomains();
  const result = await chrome.storage.sync.get(["focusModeEnabled", "focusUnlockAt"]);
  renderFocusState(result);
}

loadFocusState();

focusToggle.addEventListener("change", () => {
  if (focusToggle.checked) {
    // Locking back on: instant, and cancels any pending unlock.
    chrome.storage.sync.set({ focusModeEnabled: true, focusUnlockAt: null });
  } else {
    // Starting unlock: keep blocked, schedule cooldown.
    const unlockAt = Date.now() + UNLOCK_COOLDOWN_MS;
    // Revert the visual toggle — sites stay blocked until cooldown elapses.
    focusToggle.checked = true;
    chrome.storage.sync.set({ focusModeEnabled: true, focusUnlockAt: unlockAt });
  }
});

cancelBtn.addEventListener("click", () => {
  chrome.storage.sync.set({ focusModeEnabled: true, focusUnlockAt: null });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("focusModeEnabled" in changes || "focusUnlockAt" in changes) {
    chrome.storage.sync.get(["focusModeEnabled", "focusUnlockAt"], renderFocusState);
  }
  if ("focusBlockedDomains" in changes) {
    // Re-resolve through the shared effective-list logic: a real edit carries
    // the persisted array; a cleared/absent value falls back to the defaults
    // the blocker enforces (never to an empty list).
    getEffectiveDomains().then((domains) => {
      blockedDomains = domains;
      renderDomains();
    });
  }
});

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

// --- Google Flights Section ---
// content-flights.js writes `flights_currency` too, whenever a currency is
// picked in Flights' own footer picker; the last choice wins.
const flightsEnabled = document.getElementById("flights-enabled");
const flightsCurrency = document.getElementById("flights-currency");

chrome.storage.sync.get(["flights_enabled", "flights_currency"], (result) => {
  flightsEnabled.checked = result.flights_enabled !== false;
  const curr = result.flights_currency || "USD";
  if (![...flightsCurrency.options].some((o) => o.value === curr)) {
    flightsCurrency.add(new Option(curr, curr));
  }
  flightsCurrency.value = curr;
});

flightsEnabled.addEventListener("change", () => {
  chrome.storage.sync.set({ flights_enabled: flightsEnabled.checked });
});
flightsCurrency.addEventListener("change", () => {
  chrome.storage.sync.set({ flights_currency: flightsCurrency.value });
});
