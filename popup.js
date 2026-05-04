// Cedric's Browser Tweaks — Popup Script

// --- Focus Mode Section ---
// The blocked-domain list is stored in chrome.storage.sync under
// `focusBlockedDomains`. The service worker (background.js) seeds defaults on
// install and re-syncs declarativeNetRequest rules whenever the list changes.

const focusToggle = document.getElementById("focus-mode");
const focusList = document.getElementById("focus-site-list");
const focusAddInput = document.getElementById("focus-add-input");
const focusAddBtn = document.getElementById("focus-add-btn");
const focusAddError = document.getElementById("focus-add-error");

let blockedDomains = [];

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

chrome.storage.sync.get(["focusModeEnabled", "focusBlockedDomains"], (result) => {
  focusToggle.checked = result.focusModeEnabled === true;
  blockedDomains = Array.isArray(result.focusBlockedDomains) ? result.focusBlockedDomains : [];
  renderDomains();
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
