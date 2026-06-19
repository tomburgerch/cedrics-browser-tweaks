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

  // Apply the preferred speed exactly once per video load. We deliberately do
  // NOT keep re-applying after that: once a video is playing, the user is free
  // to change the speed (via YouTube's settings menu or the < / > shortcuts)
  // and we leave their choice alone until the next video loads.
  function observeNavigation() {
    // The content script may run (document_idle) before the <video> element
    // exists. If the initial applySpeed() found no video, watch for the first
    // one to appear, apply speed once, then disconnect — we do NOT keep
    // observing every DOM mutation, which would fight the user's later changes.
    if (!document.querySelector("video")) {
      const initialVideoObserver = new MutationObserver(() => {
        if (document.querySelector("video")) {
          applySpeed();
          initialVideoObserver.disconnect();
        }
      });
      initialVideoObserver.observe(document.body, { childList: true, subtree: true });
    }

    // YouTube is a SPA — re-apply once when navigating to a new video.
    window.addEventListener("yt-navigate-finish", () => {
      // Small delay to let the new video element initialize.
      setTimeout(applySpeed, 500);
    });
  }
})();
