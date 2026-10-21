// Browsing time for the Stats page. Counts time only while the tab is visible and focused and
// the reader is active (or media is playing), and sends it to the background worker in small
// batches. Everything stays in this browser's extension storage; it's off when settings say so.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  if (soroagent.timeTracker || !root.document || !/^https?:$/.test(root.location.protocol)) return;

  const ext = soroagent.ext || root.browser || root.chrome;
  const TICK_MS = 5000;
  const IDLE_MS = 2 * 60 * 1000; // no input for this long = away (unless media plays)
  const FLUSH_MS = 30000;

  let enabled = true;
  let lastTick = Date.now();
  let lastInput = Date.now();
  let pending = 0; // ms not yet sent
  let page = { url: soroagent.pageKey(location.href), title: document.title };
  let lastFlush = Date.now();

  const mediaPlaying = () => [...document.querySelectorAll('video, audio')].some((m) => !m.paused && !m.ended && m.readyState > 2);
  const counting = () => enabled && document.visibilityState === 'visible' && document.hasFocus() && (Date.now() - lastInput < IDLE_MS || mediaPlaying());

  function flush() {
    const ms = Math.round(pending);
    pending = 0;
    lastFlush = Date.now();
    if (ms < 1000) return;
    try {
      ext.runtime.sendMessage({ type: 'stats:add', url: page.url, title: page.title || document.title, ms }).catch(() => {});
    } catch {
      // extension reloaded; this page's tracker is gone
    }
  }

  function tick() {
    const now = Date.now();
    // Cap each step so a sleeping laptop never counts as browsing.
    if (counting()) pending += Math.min(now - lastTick, TICK_MS * 2);
    lastTick = now;
    // Single-page sites (X, Reddit, YouTube) change the address without reloading.
    const url = soroagent.pageKey(location.href);
    if (url !== page.url) {
      flush();
      page = { url, title: document.title };
    } else if (document.title) page.title = document.title;
    if (now - lastFlush >= FLUSH_MS) flush();
  }

  for (const type of ['pointerdown', 'keydown', 'wheel', 'scroll', 'mousemove', 'touchstart']) {
    root.addEventListener(type, () => (lastInput = Date.now()), { passive: true, capture: true });
  }
  document.addEventListener('visibilitychange', () => {
    tick();
    if (document.visibilityState === 'hidden') flush();
  });
  root.addEventListener('blur', () => {
    tick();
    flush();
  });
  root.addEventListener('focus', () => {
    lastTick = Date.now();
    lastInput = Date.now();
  });
  root.addEventListener('pagehide', () => {
    tick();
    flush();
  });
  setInterval(tick, TICK_MS);

  const apply = (settings) => {
    enabled = !settings || settings.trackTime !== false;
    if (!enabled) pending = 0;
  };
  ext.storage.local.get('settings').then((stored) => apply(stored.settings), () => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) apply(changes.settings.newValue);
  });

  soroagent.timeTracker = { flush };
})(globalThis);
