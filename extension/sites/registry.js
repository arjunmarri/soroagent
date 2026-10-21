// Site profiles: per-website behaviour and prompts. See extension/sites/README.md.
// This file loads first; every other extension/sites/*.js file (except names starting with "_")
// is added to the content scripts automatically by the build and calls SoroAgent.registerSite().
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});
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

  Object.assign(SoroAgent, { DEFAULT_SITE, registerSite, siteFor, siteOptionValues });
  // (A getter inside Object.assign would be copied as a one-time value.)
  Object.defineProperty(SoroAgent, 'siteProfiles', { get: () => profiles.slice(), configurable: true });
})(globalThis);
