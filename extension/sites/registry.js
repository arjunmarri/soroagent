// Site profiles: per-website behaviour and prompts. See extension/sites/README.md.
// This file loads first; every other extension/sites/*.js file (except names starting with "_")
// is added to the content scripts automatically by the build and calls soroagent.registerSite().
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  const profiles = [];

  // Used on every site that has no profile of its own.
  const DEFAULT_SITE = Object.freeze({ id: 'default', name: '', prompts: {}, options: [], matches: () => true });

  function registerSite(profile) {
    if (!profile || typeof profile.id !== 'string' || typeof profile.matches !== 'function') {
      throw new Error('registerSite: a profile needs an "id" string and a "matches(location)" function.');
    }
    if (profiles.some((p) => p.id === profile.id)) throw new Error(`registerSite: duplicate site id "${profile.id}".`);
    profiles.push({ name: profile.id, prompts: {}, options: [], ...profile });
  }

  /** The profile for a location (window.location or a URL), or the default profile. */
  function siteFor(location) {
    for (const profile of profiles) {
      try {
        if (profile.matches(location)) return profile;
      } catch {
        // a faulty profile must not break the assistant on other sites
      }
    }
    return DEFAULT_SITE;
  }

  /** Current values of a profile's options: defaults overridden by settings.siteOptions[id]. */
  function siteOptionValues(profile, settings) {
    const saved = ((settings && settings.siteOptions) || {})[profile.id] || {};
    const values = {};
    for (const option of profile.options || []) values[option.id] = option.id in saved ? Boolean(saved[option.id]) : Boolean(option.default);
    return values;
  }

  const stopped = () => Object.assign(new Error('Stopped.'), { name: 'AbortError' });
  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal && signal.aborted) return reject(stopped());
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(stopped());
        }, { once: true });
      }
    });

  // Guardrails for "Read more": one batch is bounded in posts, scroll steps and time, so a
  // request to read a little more can never turn into endless scrolling.
  const SCROLL_LIMITS = Object.freeze({ maxSteps: 30, maxMs: 45000, idleSteps: 5 });

  /**
   * Shared helper for site profiles: scrolls from `fromY` (default: where the reader is) and
   * gathers up to `target` items not in `skip`, using `visible(document, options)` to read the
   * items currently in the page. Resolves with { items, endY, exhausted }; the caller restores
   * the reader's scroll position afterwards.
   */
  async function collectByScrolling({ visible, target = 50, skip = new Set(), options = {}, signal, onProgress, fromY }) {
    const found = new Map();
    const started = Date.now();
    if (typeof fromY === 'number' && Math.abs(window.scrollY - fromY) > 4) {
      window.scrollTo(0, fromY);
      await sleep(700, signal);
    }
    let steps = 0;
    let idle = 0;
    for (;;) {
      if (signal && signal.aborted) throw stopped();
      const before = found.size;
      for (const item of visible(document, options)) {
        if (!skip.has(item.id) && !found.has(item.id)) found.set(item.id, { ...item, el: null });
      }
      if (onProgress) onProgress(Math.min(found.size, target), target);
      if (found.size >= target || steps >= SCROLL_LIMITS.maxSteps || Date.now() - started > SCROLL_LIMITS.maxMs) break;
      idle = found.size === before ? idle + 1 : 0;
      if (idle >= SCROLL_LIMITS.idleSteps) break;
      const height = document.documentElement.scrollHeight;
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.85));
      steps++;
      // Give the site time to fetch and render more.
      for (let waited = 0; waited < 2400; waited += 300) {
        await sleep(300, signal);
        if (document.documentElement.scrollHeight !== height) break;
      }
    }
    return { items: [...found.values()].slice(0, target), endY: window.scrollY, exhausted: idle >= SCROLL_LIMITS.idleSteps };
  }

  Object.assign(soroagent, { DEFAULT_SITE, registerSite, siteFor, siteOptionValues, collectByScrolling, SCROLL_LIMITS });
  // (A getter inside Object.assign would be copied as a one-time value.)
  Object.defineProperty(soroagent, 'siteProfiles', { get: () => profiles.slice(), configurable: true });
})(globalThis);
