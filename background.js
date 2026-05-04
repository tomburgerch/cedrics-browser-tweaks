// Cedric's Browser Tweaks — Focus Mode service worker
//
// Manages dynamic declarativeNetRequest rules that block distracting sites
// when Focus Mode is enabled. Toggle state lives in chrome.storage.sync under
// `focusModeEnabled` so it syncs across devices.

const BLOCKED_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "onemeilatatime.com",
  "wired.com",
  "20min.ch",
  "blick.ch",
  "digitec.ch",
  "daydeal.ch",
];

async function syncBlockRules() {
  const { focusModeEnabled } = await chrome.storage.sync.get("focusModeEnabled");
  const enabled = focusModeEnabled === true;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);

  const addRules = enabled
    ? BLOCKED_DOMAINS.map((domain, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "block" },
        condition: {
          urlFilter: `||${domain}^`,
          resourceTypes: ["main_frame"],
        },
      }))
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules,
  });
}

chrome.runtime.onInstalled.addListener(syncBlockRules);
chrome.runtime.onStartup.addListener(syncBlockRules);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && "focusModeEnabled" in changes) {
    syncBlockRules();
  }
});
