// Cedric's Browser Tweaks — Focus Mode service worker
//
// Manages dynamic declarativeNetRequest rules that block distracting sites
// when Focus Mode is enabled. Toggle state lives in chrome.storage.sync under
// `focusModeEnabled`; the editable domain list lives under `focusBlockedDomains`.
// Both sync across devices. Unlocking is gated by a 5-minute cooldown: when
// the user toggles off, `focusUnlockAt` is set to a future timestamp and an
// alarm flips `focusModeEnabled` to false on fire.

import {
  DEFAULT_BLOCKED_DOMAINS,
  sanitizeDomains,
  getEffectiveDomains,
} from "./focus-defaults.js";

const UNLOCK_ALARM = "focus-mode-unlock";

async function getDomains() {
  return getEffectiveDomains();
}

async function syncBlockRules() {
  const { focusModeEnabled } = await chrome.storage.sync.get("focusModeEnabled");
  const enabled = focusModeEnabled === true;
  const domains = await getDomains();

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);

  const addRules = enabled
    ? domains.map((domain, index) => ({
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

async function seedDefaultsIfMissing() {
  const { focusBlockedDomains } = await chrome.storage.sync.get("focusBlockedDomains");
  if (sanitizeDomains(focusBlockedDomains) === null) {
    await chrome.storage.sync.set({ focusBlockedDomains: DEFAULT_BLOCKED_DOMAINS });
  }
}

async function reconcileUnlockAlarm() {
  const { focusUnlockAt } = await chrome.storage.sync.get("focusUnlockAt");
  await chrome.alarms.clear(UNLOCK_ALARM);

  if (typeof focusUnlockAt !== "number") return;

  if (focusUnlockAt <= Date.now()) {
    // Cooldown elapsed while service worker was asleep — apply unlock now.
    await chrome.storage.sync.set({ focusModeEnabled: false, focusUnlockAt: null });
    return;
  }

  chrome.alarms.create(UNLOCK_ALARM, { when: focusUnlockAt });
}

chrome.runtime.onInstalled.addListener(async () => {
  await seedDefaultsIfMissing();
  await syncBlockRules();
  await reconcileUnlockAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await syncBlockRules();
  await reconcileUnlockAlarm();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if ("focusModeEnabled" in changes || "focusBlockedDomains" in changes) {
    syncBlockRules();
  }
  if ("focusUnlockAt" in changes) {
    reconcileUnlockAlarm();
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== UNLOCK_ALARM) return;
  await chrome.storage.sync.set({ focusModeEnabled: false, focusUnlockAt: null });
});
