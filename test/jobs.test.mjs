import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('background/jobs.js');
const rec = (id, createdAt, extra = {}) => ({ id, createdAt, status: 'done', seen: true, url: 'https://a.test/', ...extra });

test('fillPlaceholder inserts merged notes into the final prompt', () => {
  const out = S.fillPlaceholder([{ role: 'system', content: 'sys' }, { role: 'user', content: 'Notes:\n@@N@@\nEnd @@N@@' }], '@@N@@', 'A');
  assert.deepEqual(out, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'Notes:\nA\nEnd A' }]);
});

test('history is pruned oldest first and never drops a running job', () => {
  const records = [
    rec('new', '2026-10-21T10:00:00Z'),
    rec('mid', '2026-10-20T10:00:00Z'),
    rec('old-running', '2026-10-01T10:00:00Z', { status: 'running' }),
    rec('old', '2026-09-01T10:00:00Z'),
  ];
  assert.deepEqual(S.idsToPrune(records, 2), ['old']);
  assert.deepEqual(S.idsToPrune(records, 10), []);
});

test('a page shows its running jobs and unseen results, oldest first', () => {
  const records = [
    rec('seen', '2026-10-21T09:00:00Z'),
    rec('unseen', '2026-10-21T10:00:00Z', { seen: false }),
    rec('running', '2026-10-21T08:00:00Z', { status: 'running', seen: false }),
    rec('other-page', '2026-10-21T11:00:00Z', { seen: false, url: 'https://b.test/' }),
    rec('failed', '2026-10-21T12:00:00Z', { status: 'error', seen: false }),
  ];
  assert.deepEqual(S.pendingForUrl(records, 'https://a.test/').map((r) => r.id), ['running', 'unseen', 'failed']);
  assert.equal(S.unseenCount(records), 3, 'badge counts finished results not yet seen (any page)');
});
