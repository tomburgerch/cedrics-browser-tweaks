// Netflix Speed Saver - Content Script
// Applies the user's preferred playback speed on Netflix, including 1.75x and
// 2x, which Netflix's own Playback Speed menu (max 1.5x) cannot reach.
//
// Manual-vs-reset rule (never fight a manual change; see PR #10 for YouTube):
//   - A new playback (a video's `loadedmetadata` for a new source, its first
//     `playing`, or a new /watch/<id> path) applies the stored speed, opens a
//     grace window (GRACE_MS) and clears any earlier manual choice. The first
//     `playing` of a source extends the window again. A `loadedmetadata` for
//     the SAME source (MediaSource re-attach) reopens the window and re-applies
//     but keeps the manual choice.
//   - A `ratechange` we did not cause INSIDE the window is a Netflix reset
//     (player init, buffering): re-apply. Gestures do not count here, because
//     the click on Play / Next episode is itself a gesture.
//   - OUTSIDE the window it is the user's choice only if a trusted
//     pointerdown/keydown happened in the last GESTURE_MS AND (the new rate is
//     not 1, OR the gesture landed inside a speed control). A change to exactly
//     1 after a click elsewhere (Skip Intro, scrub bar, space, arrows) is a
//     Netflix reset.
//   - A manual choice stores `state.userRate`; from then on resets restore that
//     rate instead of the stored speed, until the next source starts.
//   - Re-applies are limited to RATE_LIMIT per RATE_WINDOW_MS per video; when
//     the limit trips, ONE delayed re-apply is scheduled for when it frees up.
//   - Our own writes are tagged with `state.expected`, so they never trigger a
//     reaction and cannot loop.
// Note: after an extension reload, an already-open tab keeps running the old
// script until that tab is reloaded.

(function () {
  const STORAGE_KEY = "netflixSpeed";
  const DEFAULT_SPEED = 1.5;
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4;
  const GRACE_MS = 3000;
  const GESTURE_MS = 1500;
  const RATE_LIMIT = 5;
  const RATE_WINDOW_MS = 10000;
  const SPEED_CONTROL =
    '[data-uia*="speed" i], [aria-label*="speed" i], [data-uia*="playback-rate" i]';
  const EPS = 1e-6;

  let speed = DEFAULT_SPEED;
  let lastPath = location.pathname;
  let lastGestureAt = 0;
  let lastGestureTarget = null;
  const seen = new WeakSet(); // videos that already have listeners
  // video -> { key, playedKey, graceUntil, expected, userChose, userRate,
  //            stamps, timer, srcId, choiceId }
  const states = new WeakMap();

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

  function isOne(rate) {
    return Math.abs(rate - 1) < EPS;
  }

  function targetRate(state) {
    return state.userChose ? state.userRate : speed;
  }

  // Is there anything to enforce? (1x with no manual choice means off.)
  function active(state) {
    return state.userChose || !isOne(speed);
  }

  function inSpeedControl(target) {
    return !!target && typeof target.closest === "function" && !!target.closest(SPEED_CONTROL);
  }

  // Set the rate, tagging it as ours so the ratechange handler ignores it.
  function setRate(video, rate) {
    const state = states.get(video);
    if (Math.abs(video.playbackRate - rate) < EPS) return;
    state.expected = rate;
    video.playbackRate = rate;
  }

  function clearTimer(state) {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
  }

  // Re-apply the target rate, at most RATE_LIMIT times per RATE_WINDOW_MS.
  function reapply(video, state) {
    const now = Date.now();
    state.stamps = state.stamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (state.stamps.length >= RATE_LIMIT) {
      if (state.timer) return;
      console.debug("[browser-tweaks netflix] re-apply limit hit; retrying later");
      const srcId = state.srcId;
      const choiceId = state.choiceId;
      const wait = state.stamps[0] + RATE_WINDOW_MS - now + 50;
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.srcId !== srcId || state.choiceId !== choiceId) return;
        if (!onWatchPage() || !active(state)) return;
        state.stamps.push(Date.now());
        setRate(video, targetRate(state));
      }, wait);
      return;
    }
    state.stamps.push(now);
    setRate(video, targetRate(state));
  }

  // A new playback began on this video: apply and open the grace window.
  function startSource(video) {
    if (!onWatchPage()) return;
    const state = states.get(video);
    state.key = sourceKey(video);
    state.playedKey = null;
    // This playback belongs to the current path. Without this, a src swap
    // (no DOM mutation) leaves lastPath stale and the next unrelated mutation
    // would restart the source and override a manual choice.
    lastPath = location.pathname;
    state.graceUntil = Date.now() + GRACE_MS;
    state.stamps = [];
    state.srcId++;
    clearTimer(state);
    state.userChose = false;
    state.userRate = null;
    if (isOne(speed)) return; // 1x means off
    setRate(video, speed);
    console.debug("[browser-tweaks netflix] applied", speed);
  }

  // Same source attached again: reopen the window, keep the manual choice.
  function reopenSource(video) {
    if (!onWatchPage()) return;
    const state = states.get(video);
    state.graceUntil = Date.now() + GRACE_MS;
    if (active(state)) setRate(video, targetRate(state));
  }

  function onRateChange(video) {
    const state = states.get(video);
    if (state.expected !== null && Math.abs(video.playbackRate - state.expected) < EPS) {
      state.expected = null; // our own write
      return;
    }
    state.expected = null;
    if (!onWatchPage() || !active(state)) return;
    const now = Date.now();
    const gesture = now - lastGestureAt <= GESTURE_MS;
    if (now >= state.graceUntil && gesture &&
        (!isOne(video.playbackRate) || inSpeedControl(lastGestureTarget))) {
      state.userChose = true; // manual change: remember it, stop fighting it
      state.userRate = video.playbackRate;
      state.choiceId++;
      clearTimer(state);
      return;
    }
    reapply(video, state); // Netflix reset: restore the target rate
  }

  function attach(video) {
    if (seen.has(video)) return;
    seen.add(video);
    states.set(video, {
      key: null, playedKey: null, graceUntil: 0, expected: null,
      userChose: false, userRate: null, stamps: [], timer: null, srcId: 0, choiceId: 0,
    });
    video.addEventListener("loadedmetadata", () => {
      if (sourceKey(video) !== states.get(video).key) startSource(video);
      else reopenSource(video);
    });
    video.addEventListener("playing", () => {
      const state = states.get(video);
      if (state.key !== sourceKey(video)) startSource(video);
      if (state.key && state.playedKey !== state.key) {
        state.playedKey = state.key; // first play of this source: extend grace
        state.graceUntil = Date.now() + GRACE_MS;
      }
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
      state.userRate = null;
      state.choiceId++;
      clearTimer(state);
      setRate(video, speed);
    }
  });

  const noteGesture = (e) => {
    if (!e.isTrusted) return;
    lastGestureAt = Date.now();
    lastGestureTarget = e.target;
  };
  window.addEventListener("pointerdown", noteGesture, { capture: true, passive: true });
  window.addEventListener("keydown", noteGesture, { capture: true, passive: true });

  // Start only once the stored speed is known, so the first scan never applies
  // the default and then corrects it.
  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    if (result[STORAGE_KEY] !== undefined) speed = clamp(result[STORAGE_KEY]);
    new MutationObserver(scan).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    scan();
  });
})();
