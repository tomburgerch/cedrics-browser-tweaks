// YouTube Speed Saver - Content Script
// Automatically applies the user's preferred playback speed on YouTube.

(function () {
  const DEFAULT_SPEED = 2.0;
  let preferredSpeed = DEFAULT_SPEED;

  // Load saved speed from storage
  chrome.storage.sync.get("preferredSpeed", (result) => {
    if (result.preferredSpeed) {
      preferredSpeed = result.preferredSpeed;
    }
    applySpeed();
    observeNavigation();
  });

  // Listen for speed changes from the popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.preferredSpeed) {
      preferredSpeed = changes.preferredSpeed.newValue;
      applySpeed();
    }
  });

  function applySpeed() {
    const video = document.querySelector("video");
    if (video) {
      video.playbackRate = preferredSpeed;
    }
  }

  // YouTube is a SPA — watch for navigation changes so we re-apply speed on new videos
  function observeNavigation() {
    // Re-apply when a new video element appears or src changes
    const observer = new MutationObserver(() => {
      const video = document.querySelector("video");
      if (video && video.playbackRate !== preferredSpeed) {
        video.playbackRate = preferredSpeed;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also handle the ratechange event — YouTube resets speed on new video loads
    document.addEventListener(
      "ratechange",
      (e) => {
        if (e.target.tagName === "VIDEO" && e.target.playbackRate !== preferredSpeed) {
          e.target.playbackRate = preferredSpeed;
        }
      },
      true
    );

    // Handle YouTube's SPA navigation via yt-navigate-finish
    window.addEventListener("yt-navigate-finish", () => {
      // Small delay to let the new video element initialize
      setTimeout(applySpeed, 500);
    });
  }
})();
