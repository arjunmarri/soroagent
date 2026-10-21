import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/backup.js');

test('storage upgrades add snippet kinds once and record the schema version', () => {
  const all = {
    'snippet:a': { id: 'a', source: 'selection', text: 'x' },
    'snippet:b': { id: 'b', source: 'page', text: 'y' },
    'snippet:c': { id: 'c', kind: 'summary', text: 'z' },
    settings: { model: 'm' },
  };
  const updates = S.planMigrations(all);
  assert.equal(updates['snippet:a'].kind, 'selection');
  assert.equal(updates['snippet:b'].kind, 'page');
  assert.equal(updates['snippet:c'], undefined, 'already upgraded');
  assert.equal(updates.meta.schemaVersion, S.SCHEMA_VERSION);
  assert.deepEqual(S.planMigrations({ ...all, ...updates }), {}, 'nothing left to do');
});

test('backups carry snippets, finished summaries and settings, never keys', () => {
  const all = {
    settings: { model: 'm', apiKey: 'secret-local-key', cloudProvider: 'anthropic' },
    apiKeys: { anthropic: 'sk-ant' },
    'snippet:a': { id: 'a', text: 'x' },
    'summary:1': { id: '1', status: 'done', text: 's' },
    'summary:2': { id: '2', status: 'running', text: '' },
  };
  const backup = S.buildBackup(all, '2.8.0');
  assert.equal(backup.format, 'soroagent-backup');
  assert.equal(JSON.stringify(backup).includes('secret-local-key'), false);
  assert.equal(JSON.stringify(backup).includes('sk-ant'), false);
  assert.deepEqual(backup.snippets.map((s) => s.id), ['a']);
  assert.deepEqual(backup.summaries.map((s) => s.id), ['1'], 'running jobs are not backed up');
});

test('restoring never overwrites existing items and keeps the current local key', () => {
  const backup = { format: 'soroagent-backup', snippets: [{ id: 'a', text: 'old' }, { id: 'b', text: 'new' }, { id: 'bad' }], summaries: [{ id: '1', status: 'done', seen: false }], settings: { model: 'restored' } };
  const all = { 'snippet:a': { id: 'a', text: 'mine' }, settings: { model: 'current', apiKey: 'k' } };
  const { updates, counts } = S.planRestore(backup, all);
  assert.deepEqual(Object.keys(updates).sort(), ['settings', 'snippet:b', 'summary:1']);
  assert.equal(updates['summary:1'].seen, true);
  assert.deepEqual(updates.settings, { model: 'restored', apiKey: 'k' });
  assert.deepEqual(counts, { snippets: 1, summaries: 1, statsDays: 0, settings: true });
  assert.equal(S.planRestore(backup, all, { includeSettings: false }).updates.settings, undefined);
  assert.throws(() => S.planRestore({ format: 'nope' }, all), /not a soroagent backup/);
});

test('browsing stats are backed up and restored by whole days, never overwriting', () => {
  const day = { hosts: { 'a.com': 1000 }, pages: {} };
  const backup = S.buildBackup({ 'stats:2026-10-21': day, 'stats:2026-10-22': day }, '2.16.0');
  assert.deepEqual(Object.keys(backup.stats), ['2026-10-21', '2026-10-22']);
  const { updates, counts } = S.planRestore(backup, { 'stats:2026-10-22': { hosts: { 'b.com': 5 }, pages: {} } }, { includeSettings: false });
  assert.deepEqual(Object.keys(updates), ['stats:2026-10-21']);
  assert.equal(counts.statsDays, 1);
});

test('only snippets, summaries and settings trigger an automatic backup', () => {
  assert.ok(S.isBackupWorthy({ 'snippet:x': {} }));
  assert.ok(S.isBackupWorthy({ settings: {} }));
  assert.ok(!S.isBackupWorthy({ 'stats:2026-10-22': {}, backupState: {} }));
});

test('backup file paths become file URLs on every platform', () => {
  assert.equal(S.fileUrl('/Users/a b/Downloads/soroagent/soroagent-backup.json'), 'file:///Users/a%20b/Downloads/soroagent/soroagent-backup.json');
  assert.equal(S.fileUrl('C:\\Users\\a\\Downloads\\soroagent\\soroagent-backup.json'), 'file:///C:/Users/a/Downloads/soroagent/soroagent-backup.json');
  assert.ok(new RegExp(S.BACKUP_FILE_PATTERN).test('/x/Downloads/soroagent/soroagent-backup (1).json'));
  assert.ok(!new RegExp(S.BACKUP_FILE_PATTERN).test('/x/soroagent-backup.json/other.txt'));
});
