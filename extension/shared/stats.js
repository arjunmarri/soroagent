// Browsing time, stored per day as "stats:YYYY-MM-DD" → { hosts: { host: ms }, pages: { url: { title, ms } } }.
// The record helpers are pure (unit tested); the background worker does the storing.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  const STATS_PREFIX = 'stats:';
  const MAX_PAGES_PER_DAY = 400;
  const KEEP_DAYS = 90;

  const pad = (n) => String(n).padStart(2, '0');
  /** Local calendar day, e.g. "2026-10-22". */
  const dayKey = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  // Query parameters that identify content (a video, a search, a page) rather than a person.
  const KEEP_PARAMS = new Set(['v', 'q', 'query', 'search', 's', 'id', 'p', 'page', 'list', 'tab', 'category', 'lang', 'hl']);

  /**
   * Pure: the address stats are kept under: no #fragment, no login details, and only harmless
   * query parameters, so tokens in links (password resets, sessions, invites) are never stored.
   */
  function statsUrl(url) {
    try {
      const u = new URL(url);
      const kept = [...u.searchParams].filter(([k]) => KEEP_PARAMS.has(k.toLowerCase()));
      const query = kept.length ? `?${new URLSearchParams(kept)}` : '';
      return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}${query}`;
    } catch {
      return '';
    }
  }

  /** Pure: a day's record with `ms` more on `url`. Keeps the busiest pages when there are many. */
  function addTime(day, { url, title, ms }) {
    const host = hostOf(url);
    const time = Math.max(0, Math.min(Number(ms) || 0, 10 * 60 * 1000)); // one report is at most a few ticks
    if (!host || !time) return day || { hosts: {}, pages: {} };
    const next = { hosts: { ...((day && day.hosts) || {}) }, pages: { ...((day && day.pages) || {}) } };
    next.hosts[host] = (next.hosts[host] || 0) + time;
    const before = next.pages[url] || { title: '', ms: 0 };
    next.pages[url] = { title: String(title || before.title || '').slice(0, 200), ms: before.ms + time };
    const urls = Object.keys(next.pages);
    if (urls.length > MAX_PAGES_PER_DAY) {
      urls.sort((a, b) => next.pages[a].ms - next.pages[b].ms);
      for (const drop of urls.slice(0, urls.length - MAX_PAGES_PER_DAY)) delete next.pages[drop];
    }
    return next;
  }

  /**
   * Pure: totals over several days ({ "2026-10-22": record, … }):
   * { total, days: [{ day, ms }], sites: [{ host, ms }], pages: [{ url, host, title, ms }] }, busiest first.
   */
  function summarizeStats(byDay) {
    const sites = new Map();
    const pages = new Map();
    const days = [];
    let total = 0;
    for (const [day, record] of Object.entries(byDay || {})) {
      let dayMs = 0;
      for (const [host, ms] of Object.entries((record && record.hosts) || {})) {
        sites.set(host, (sites.get(host) || 0) + ms);
        dayMs += ms;
      }
      for (const [url, page] of Object.entries((record && record.pages) || {})) {
        const current = pages.get(url) || { url, host: hostOf(url), title: '', ms: 0 };
        current.ms += page.ms || 0;
        current.title = page.title || current.title;
        pages.set(url, current);
      }
      days.push({ day, ms: dayMs });
      total += dayMs;
    }
    return {
      total,
      days: days.sort((a, b) => a.day.localeCompare(b.day)),
      sites: [...sites].map(([host, ms]) => ({ host, ms })).sort((a, b) => b.ms - a.ms),
      pages: [...pages.values()].sort((a, b) => b.ms - a.ms),
    };
  }

  /** Pure: two day records added together (time on the same day from two browsers). */
  function mergeDays(a, b) {
    if (!a) return b;
    if (!b) return a;
    const out = { hosts: { ...(a.hosts || {}) }, pages: { ...(a.pages || {}) } };
    for (const [h, ms] of Object.entries(b.hosts || {})) out.hosts[h] = (out.hosts[h] || 0) + ms;
    for (const [u, p] of Object.entries(b.pages || {})) out.pages[u] = { title: (out.pages[u] && out.pages[u].title) || p.title, ms: ((out.pages[u] && out.pages[u].ms) || 0) + (p.ms || 0) };
    return out;
  }

  /** "2h 05m", "12m", "45s". */
  function formatDuration(ms) {
    const seconds = Math.round((ms || 0) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${pad(minutes % 60)}m`;
  }

  /** Pure: the stats keys older than KEEP_DAYS before `today`. */
  function expiredStatsKeys(keys, today = new Date()) {
    const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - KEEP_DAYS);
    const cut = dayKey(cutoff);
    return keys.filter((k) => k.startsWith(STATS_PREFIX) && k.slice(STATS_PREFIX.length) < cut);
  }

  Object.assign(soroagent, { mergeDays, statsUrl, STATS_PREFIX, STATS_KEEP_DAYS: KEEP_DAYS, statsDayKey: dayKey, addTime, summarizeStats, formatDuration, expiredStatsKeys });
})(globalThis);
