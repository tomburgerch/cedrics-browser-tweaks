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
