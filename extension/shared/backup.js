// Backups and storage upgrades for soroagent's data (settings, snippets, summary history).
// Data lives in chrome.storage.local, which survives extension updates as long as the extension
// ID stays the same (the Chrome build pins it; see keys/README.md). Backups move data between
// installs with different IDs (for example from an older unpacked copy to the store version).
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  const SCHEMA_VERSION = 3;
  const FORMAT = 'soroagent-backup';
  const DATA_PREFIXES = ['snippet:', 'summary:', 'stats:'];
  // The automatic backup, relative to the browser's Downloads folder (overwritten each time).
  const BACKUP_FILE = 'soroagent/soroagent-backup.json';
  const BACKUP_FILE_PATTERN = 'soroagent-backup[^/\\\\]*\\.json$';

  // Each step upgrades stored data from version n-1 to n. Steps must be safe to re-run.
  const MIGRATIONS = {
    // v2: snippets get a `kind` (summary | selection | page | research) for the reading view.
    2: (all) => {
      const updates = {};
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith('snippet:') && value && !value.kind) {
          updates[key] = { ...value, kind: value.source === 'selection' ? 'selection' : value.source === 'summary' ? 'summary' : 'page' };
        }
      }
      return updates;
    },
    // v3: the wish list was retired; its items become read-later pages (with the price kept).
    3: (all) => {
      const updates = {};
      for (const [key, value] of Object.entries(all)) {
        if (key.startsWith('snippet:') && value && value.kind === 'wishlist') {
          const { price, image, boughtAt, ...rest } = value;
          updates[key] = { ...rest, kind: 'readlater', source: 'readlater', summary: value.summary || price || '', ...(boughtAt ? { readAt: boughtAt } : {}) };
        }
      }
      return updates;
    },
  };

  /** Pure: the storage updates needed to bring `all` (a storage dump) to the current schema. */
  function planMigrations(all) {
    const from = Number((all.meta && all.meta.schemaVersion) || 1);
    let working = { ...all };
    const updates = {};
    for (let version = from + 1; version <= SCHEMA_VERSION; version++) {
      const step = MIGRATIONS[version];
      if (!step) continue;
      const changes = step(working);
      Object.assign(updates, changes);
      working = { ...working, ...changes };
    }
    if (from < SCHEMA_VERSION) updates.meta = { ...(all.meta || {}), schemaVersion: SCHEMA_VERSION };
    return updates;
  }

  async function migrate(storage) {
    const updates = planMigrations(await storage.get(null));
    if (Object.keys(updates).length) await storage.set(updates);
    return Object.keys(updates).length;
  }

  /** True when storage changes touch data worth backing up (stats alone don't trigger a backup). */
  function isBackupWorthy(changes) {
    return Object.keys(changes).some((k) => k === 'settings' || k.startsWith('snippet:') || k.startsWith('summary:'));
  }

  /** Pure: a file:// URL for a local path from the downloads API (macOS, Linux or Windows). */
  function fileUrl(path) {
    const forward = String(path || '').replace(/\\/g, '/');
    return `file://${forward.startsWith('/') ? '' : '/'}${encodeURI(forward).replace(/#/g, '%23').replace(/\?/g, '%3F')}`;
  }

  /** Pure: a backup object from a storage dump. API keys are never included. */
  function buildBackup(all, appVersion) {
    const settings = { ...(all.settings || {}) };
    delete settings.apiKey; // local-server key; cloud keys are stored encrypted elsewhere
    const pick = (prefix) => Object.keys(all).filter((k) => k.startsWith(prefix)).map((k) => all[k]);
    return {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion,
      exportedAt: new Date().toISOString(),
      settings,
      snippets: pick('snippet:'),
      summaries: pick('summary:').filter((s) => s.status !== 'running'),
      stats: Object.fromEntries(Object.keys(all).filter((k) => k.startsWith('stats:')).map((k) => [k.slice(6), all[k]])),
    };
  }

  /**
   * Pure: storage updates that restore a backup into `all` without overwriting anything that's
   * already there (matching ids are skipped). Returns { updates, counts }.
   */
  function planRestore(backup, all, { includeSettings = true } = {}) {
    if (!backup || backup.format !== FORMAT) throw new Error('This file is not a soroagent backup.');
    const updates = {};
    const counts = { snippets: 0, summaries: 0, statsDays: 0, settings: false };
    for (const snippet of backup.snippets || []) {
      if (snippet && snippet.id && typeof snippet.text === 'string' && !all[`snippet:${snippet.id}`]) {
        updates[`snippet:${snippet.id}`] = snippet;
        counts.snippets++;
      }
    }
    for (const summary of backup.summaries || []) {
      if (summary && summary.id && !all[`summary:${summary.id}`]) {
        updates[`summary:${summary.id}`] = { ...summary, seen: true };
        counts.summaries++;
      }
    }
    // Browsing stats: whole days that aren't here yet.
    for (const [day, record] of Object.entries(backup.stats || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && record && record.hosts && !all[`stats:${day}`]) {
        updates[`stats:${day}`] = record;
        counts.statsDays++;
      }
    }
    if (includeSettings && backup.settings) {
      updates.settings = { ...(all.settings || {}), ...backup.settings, apiKey: (all.settings || {}).apiKey || '' };
      counts.settings = true;
    }
    return { updates, counts };
  }

  Object.assign(soroagent, { SCHEMA_VERSION, DATA_PREFIXES, BACKUP_FILE, BACKUP_FILE_PATTERN, isBackupWorthy, fileUrl, planMigrations, migrate, buildBackup, planRestore });
})(globalThis);
