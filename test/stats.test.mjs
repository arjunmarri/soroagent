import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/stats.js');

test('time adds up per website and per page', () => {
  let day = S.addTime(undefined, { url: 'https://www.youtube.com/watch?v=1', title: 'Video', ms: 30000 });
  day = S.addTime(day, { url: 'https://www.youtube.com/watch?v=1', title: 'Video', ms: 15000 });
  day = S.addTime(day, { url: 'https://m.youtube.com/feed', title: 'Feed', ms: 5000 });
  assert.equal(day.hosts['youtube.com'], 45000);
  assert.equal(day.hosts['m.youtube.com'], 5000);
  assert.deepEqual(day.pages['https://www.youtube.com/watch?v=1'], { title: 'Video', ms: 45000 });
});

test('bad reports are ignored and one report is capped', () => {
  assert.deepEqual(S.addTime(undefined, { url: 'not a url', ms: 1000 }), { hosts: {}, pages: {} });
  const day = S.addTime(undefined, { url: 'https://a.com/', ms: 99 * 60 * 60 * 1000 });
  assert.equal(day.hosts['a.com'], 10 * 60 * 1000);
});

test('only the busiest pages are kept on a very busy day', () => {
  let day;
  for (let i = 0; i < 405; i++) day = S.addTime(day, { url: `https://a.com/${i}`, ms: 1000 + i });
  assert.equal(Object.keys(day.pages).length, 400);
  assert.ok(!day.pages['https://a.com/0'] && day.pages['https://a.com/404']);
  assert.equal(day.hosts['a.com'], Array.from({ length: 405 }, (_, i) => 1000 + i).reduce((a, b) => a + b), 'site totals stay exact');
});

test('days add up into totals, busiest first', () => {
  const stats = S.summarizeStats({
    '2026-10-21': { hosts: { 'a.com': 60000, 'b.com': 30000 }, pages: { 'https://a.com/x': { title: 'X', ms: 60000 } } },
    '2026-10-20': { hosts: { 'b.com': 90000 }, pages: { 'https://a.com/x': { title: 'X old', ms: 10000 } } },
  });
  assert.equal(stats.total, 180000);
  assert.deepEqual(stats.days.map((d) => d.day), ['2026-10-20', '2026-10-21']);
  assert.deepEqual(stats.sites, [{ host: 'b.com', ms: 120000 }, { host: 'a.com', ms: 60000 }]);
  assert.equal(stats.pages[0].ms, 70000);
});

test('durations read naturally', () => {
  assert.equal(S.formatDuration(45000), '45s');
  assert.equal(S.formatDuration(12 * 60000), '12m');
  assert.equal(S.formatDuration(125 * 60000), '2h 05m');
});

test('stats older than 90 days expire', () => {
  const keys = ['stats:2026-07-23', 'stats:2026-07-24', 'stats:2026-10-22', 'snippet:x'];
  assert.deepEqual(S.expiredStatsKeys(keys, new Date(2026, 9, 22)), ['stats:2026-07-23']);
});
