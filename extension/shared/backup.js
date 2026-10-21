// Backups and storage upgrades for SoroAgent's data (settings, snippets, summary history).
// Data lives in chrome.storage.local, which survives extension updates as long as the extension
// ID stays the same (the Chrome build pins it; see keys/README.md). Backups move data between
// installs with different IDs (for example from an older unpacked copy to the store version).
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});
  const SCHEMA_VERSION = 2;
  const FORMAT = 'soroagent-backup';
  const DATA_PREFIXES = ['snippet:', 'summary:'];

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
    };
  }

  /**
   * Pure: storage updates that restore a backup into `all` without overwriting anything that's
   * already there (matching ids are skipped). Returns { updates, counts }.
   */
  function planRestore(backup, all, { includeSettings = true } = {}) {
    if (!backup || backup.format !== FORMAT) throw new Error('This file is not a SoroAgent backup.');
    const updates = {};
    const counts = { snippets: 0, summaries: 0, settings: false };
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
    if (includeSettings && backup.settings) {
      updates.settings = { ...(all.settings || {}), ...backup.settings, apiKey: (all.settings || {}).apiKey || '' };
      counts.settings = true;
    }
    return { updates, counts };
  }

  Object.assign(SoroAgent, { SCHEMA_VERSION, DATA_PREFIXES, planMigrations, migrate, buildBackup, planRestore });
})(globalThis);
