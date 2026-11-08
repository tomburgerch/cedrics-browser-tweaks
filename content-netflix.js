// Netflix Speed Saver - Content Script
// Applies the user's preferred playback speed on Netflix, including 1.75x and
// 2x, which Netflix's own Playback Speed menu (max 1.5x) cannot reach.
//
// Manual-vs-reset rule (never fight a manual change; see PR #10 for YouTube):
//   - When a new playback starts (a video's `loadedmetadata`, its first
//     `playing` for a new source, or a new /watch/<id> path) we apply the
//     speed, open a grace window (GRACE_MS) and clear any earlier user choice.
//   - A `ratechange` we did not cause INSIDE the window is a Netflix reset
//     (player init, buffering): always re-apply. Gestures do not count here,
//     because the click on Play / Next episode is itself a gesture.
//   - A `ratechange` we did not cause OUTSIDE the window is the user's choice
//     only if a trusted pointerdown/keydown happened in the last GESTURE_MS
//     (Netflix's speed menu needs a click). Without one it is a Netflix reset
//     (quality switch, seek, buffering) and we re-apply.
//   - After a manual choice (`state.userChose`) we stop re-applying on that
//     source until the next one starts.
//   - Re-applies are capped per source (MAX_REAPPLY) to avoid a tug of war.
//   - Our own writes are tagged with `state.expected`, so they never trigger a
//     reaction and cannot loop.

(function () {
  const STORAGE_KEY = "netflixSpeed";
  const DEFAULT_SPEED = 1.5;
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4;
  const GRACE_MS = 3000;
  const MAX_REAPPLY = 20;
  const GESTURE_MS = 1500;
  const EPS = 1e-6;

  let speed = DEFAULT_SPEED;
  let lastPath = location.pathname;
  let lastGestureAt = 0;
  const seen = new WeakSet(); // videos that already have listeners
  const states = new WeakMap(); // video -> { key, graceUntil, expected, reapplied, userChose }

  function clamp(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_SPEED;
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
  }

  function onWatchPage() {
    return location.pathname.startsWith("/watch");
  }

  function sourceKey(video) {
    return location.pathname + "|" + (video.currentSrc || "");
  }

  // Set the rate, tagging it as ours so the ratechange handler ignores it.
  function setRate(video, rate) {
    const state = states.get(video);
    if (Math.abs(video.playbackRate - rate) < EPS) return;
    state.expected = rate;
    video.playbackRate = rate;
  }

  // A new playback began on this video: apply and open the grace window.
  function startSource(video) {
    if (!onWatchPage()) return;
    const state = states.get(video);
    state.key = sourceKey(video);
    state.graceUntil = Date.now() + GRACE_MS;
    state.reapplied = 0;
    state.userChose = false;
    if (Math.abs(speed - 1) < EPS) return; // 1x means off
    setRate(video, speed);
    console.debug("[browser-tweaks netflix] applied", speed);
  }

  function onRateChange(video) {
    const state = states.get(video);
    if (state.expected !== null && Math.abs(video.playbackRate - state.expected) < EPS) {
      state.expected = null; // our own write
      return;
    }
    state.expected = null;
    if (!onWatchPage() || Math.abs(speed - 1) < EPS || state.userChose) return;
    const now = Date.now();
    if (now >= state.graceUntil && now - lastGestureAt <= GESTURE_MS) {
      state.userChose = true; // manual change: leave it alone for this source
      return;
    }
    if (state.reapplied < MAX_REAPPLY) {
      state.reapplied++; // Netflix reset: re-apply
      setRate(video, speed);
    }
  }

  function attach(video) {
    if (seen.has(video)) return;
    seen.add(video);
    states.set(video, { key: null, graceUntil: 0, expected: null, reapplied: 0, userChose: false });
    video.addEventListener("loadedmetadata", () => startSource(video));
    video.addEventListener("playing", () => {
      if (states.get(video).key !== sourceKey(video)) startSource(video);
    });
    video.addEventListener("ratechange", () => onRateChange(video));
    // Video may already be loaded when we find it.
    if (video.readyState >= 1) startSource(video);
  }

  const videos = document.getElementsByTagName("video"); // live, cheap

  function scan() {
    for (const video of videos) attach(video);
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      // SPA navigation (e.g. next episode): treat as a new playback.
      for (const video of videos) {
        if (seen.has(video) && video.readyState >= 1) startSource(video);
      }
    }
  }

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (result[STORAGE_KEY] !== undefined) speed = clamp(result[STORAGE_KEY]);
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes[STORAGE_KEY]) return;
    const next = changes[STORAGE_KEY].newValue;
    speed = next === undefined ? DEFAULT_SPEED : clamp(next);
    if (!onWatchPage()) return;
    for (const video of videos) {
      if (!seen.has(video)) continue;
      const state = states.get(video);
      state.graceUntil = 0;
      state.userChose = false; // a popup choice replaces an earlier manual one
      setRate(video, speed);
    }
  });

  const noteGesture = (e) => {
    if (e.isTrusted) lastGestureAt = Date.now();
  };
  window.addEventListener("pointerdown", noteGesture, { capture: true, passive: true });
  window.addEventListener("keydown", noteGesture, { capture: true, passive: true });

  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  scan();
})();
