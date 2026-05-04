// Cedric's Browser Tweaks — Popup Script

// --- Focus Mode Section ---
// Keep this list in sync with BLOCKED_DOMAINS in background.js.
const FOCUS_SITES = [
  "instagram.com",
  "facebook.com",
  "onemeilatatime.com",
  "wired.com",
  "20min.ch",
  "blick.ch",
  "digitec.ch",
  "daydeal.ch",
];

const focusToggle = document.getElementById("focus-mode");
const focusList = document.getElementById("focus-site-list");

focusList.innerHTML = FOCUS_SITES.map((d) => `<li>${d}</li>`).join("");

chrome.storage.sync.get("focusModeEnabled", (result) => {
  focusToggle.checked = result.focusModeEnabled === true;
});

focusToggle.addEventListener("change", () => {
  chrome.storage.sync.set({ focusModeEnabled: focusToggle.checked });
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
