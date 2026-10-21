import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/snippets.js');
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).toISOString();

test('dayLabel names recent days and dates further back', () => {
  const now = new Date(2026, 9, 21, 15); // Wed 21 Oct 2026
  assert.equal(S.dayLabel(new Date(2026, 9, 21, 1), now, 'en-US'), 'Today');
  assert.equal(S.dayLabel(new Date(2026, 9, 20, 23), now, 'en-US'), 'Yesterday');
  assert.equal(S.dayLabel(new Date(2026, 9, 17), now, 'en-US'), 'Saturday');
  assert.match(S.dayLabel(new Date(2026, 8, 3), now, 'en-US'), /September 3/);
  assert.match(S.dayLabel(new Date(2025, 11, 31), now, 'en-US'), /2025/);
});

test('groupTimeline groups newest first by month and day', () => {
  const now = new Date(2026, 9, 21, 15);
  const snippets = [
    { id: 'a', createdAt: at(2026, 10, 20, 9) },
    { id: 'b', createdAt: at(2026, 10, 21, 8) },
    { id: 'c', createdAt: at(2026, 9, 30) },
    { id: 'd', createdAt: at(2026, 10, 21, 14) },
    { id: 'bad', createdAt: 'not a date' },
  ];
  const months = S.groupTimeline(snippets, now, 'en-US');
  assert.deepEqual(months.map((m) => [m.label, m.count]), [['October 2026', 3], ['September 2026', 1]]);
  assert.deepEqual(months[0].days.map((d) => [d.label, d.items.map((i) => i.id)]), [['Today', ['d', 'b']], ['Yesterday', ['a']]]);
  assert.deepEqual(months[1].days[0].items.map((i) => i.id), ['c']);
});
