// Cedric's Browser Tweaks — Focus Mode shared defaults
//
// Single source of truth for the default block list and how the effective
// list is derived from chrome.storage.sync. Imported by BOTH the service
// worker (background.js) and the popup (popup.js) so the blocker and the UI
// can never disagree about what is being enforced.
//
// Why this exists: previously background.js fell back to DEFAULT_BLOCKED_DOMAINS
// when `focusBlockedDomains` was not yet an array, while the popup fell back to
// []. On a freshly synced profile (where onInstalled's seed had not run) the
// blocker enforced 8 defaults but the popup showed "(no sites)" — and the first
// "add" wrote a 1-element array, silently dropping the 7 enforced defaults.

export const DEFAULT_BLOCKED_DOMAINS = [
  "instagram.com",
  "facebook.com",
  "onemileatatime.com",
  "wired.com",
  "20min.ch",
  "blick.ch",
  "digitec.ch",
  "daydeal.ch",
];

// Normalize a stored value into a clean string[] (drops non-strings / empties).
export function sanitizeDomains(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((d) => typeof d === "string" && d.length > 0);
}

// Resolve the effective block list from a storage.sync read.
// Falls back to DEFAULT_BLOCKED_DOMAINS whenever the stored value is not yet
// a usable array — identical behavior in the service worker and the popup.
export async function getEffectiveDomains() {
  const { focusBlockedDomains } = await chrome.storage.sync.get("focusBlockedDomains");
  return sanitizeDomains(focusBlockedDomains) ?? DEFAULT_BLOCKED_DOMAINS;
}
