import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load, root, promptFiles } from './helpers.mjs';

const siteFiles = readdirSync(join(root, 'extension/sites')).filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'registry.js');
const S = await load('shared/markdown.js', 'shared/prompts.js', ...promptFiles, 'sites/registry.js', ...siteFiles.map((f) => `sites/${f}`));
const loc = (url) => new URL(url);

test('every site profile registers with valid prompts and options', () => {
  const ids = S.siteProfiles.map((p) => p.id);
  assert.ok(ids.includes('x'));
  assert.equal(new Set(ids).size, ids.length);
  for (const profile of S.siteProfiles) {
    const prompts = S.promptsFor(profile.id, profile.prompts);
    for (const action of S.PROMPT_ACTIONS) {
      // Every action renders for every site without throwing.
      assert.ok(S.buildMessages(action, S.pageVars({ title: 't', url: 'u', text: 'c' }), prompts).length > 0, `${profile.id}.${action}`);
    }
    for (const option of profile.options || []) assert.ok(option.id && option.label, `${profile.id}: option needs id and label`);
  }
});

test('siteFor matches X hosts and falls back to the default profile', () => {
  assert.equal(S.siteFor(loc('https://x.com/home')).id, 'x');
  assert.equal(S.siteFor(loc('https://mobile.twitter.com/someone')).id, 'x');
  assert.equal(S.siteFor(loc('https://example.com/')).id, 'default');
  assert.equal(S.siteFor(loc('https://notx.com/')).id, 'default');
});

test('siteOptionValues merges defaults with saved values', () => {
  const x = S.siteFor(loc('https://x.com/'));
  assert.deepEqual(S.siteOptionValues(x, {}), { verifiedOnly: false, hidePromoted: false });
  assert.deepEqual(S.siteOptionValues(x, { siteOptions: { x: { verifiedOnly: true } } }), { verifiedOnly: true, hidePromoted: false });
});

test('X page detection', () => {
  const { pageInfo } = S.siteHelpers.x;
  const search = pageInfo(loc('https://x.com/search?q=local%20llm&src=typed_query&f=live'));
  assert.equal(search.type, 'search');
  assert.equal(search.query, 'local llm');
  assert.match(search.context, /latest posts from X search results for the query "local llm"/);
  assert.equal(pageInfo(loc('https://x.com/jack/status/20')).type, 'thread');
  assert.equal(pageInfo(loc('https://x.com/home')).type, 'timeline');
  assert.equal(pageInfo(loc('https://x.com/jack')).type, 'profile');
  assert.equal(pageInfo(loc('https://x.com/jack/with_replies')).type, 'profile');
  assert.equal(pageInfo(loc('https://x.com/explore')).type, 'other');
  assert.equal(pageInfo(loc('https://x.com/i/bookmarks')).type, 'bookmarks');
  const x = S.siteFor(loc('https://x.com/'));
  assert.equal(x.items.isFeed(search), true);
  assert.equal(x.items.isFeed(pageInfo(loc('https://x.com/jack/status/20'))), false);
});

test('X counts and post formatting', () => {
  const { parseCount, compact, formatPosts } = S.siteHelpers.x;
  assert.equal(parseCount('1,234 Likes. Like'), 1234);
  assert.equal(parseCount('1.2K'), 1200);
  assert.equal(parseCount('3M'), 3000000);
  assert.equal(parseCount(''), 0);
  assert.equal(compact(1234), '1.2K');
  assert.equal(compact(45000), '45K');
  const text = formatPosts(
    [
      { handle: '@ada', name: 'Ada', verified: true, time: '2026-10-20T10:00:00Z', likes: 1500, reposts: 20, replies: 0, text: 'Hello' },
      { handle: '@bob', name: '', verified: false, hasMedia: true, text: '', promoted: true },
    ],
    { start: 101 }
  );
  assert.equal(text, '[101] @ada (Ada, verified) · 2026-10-20 · 1.5K likes · 20 reposts\nHello\n\n[102] @bob · AD\n[media only]');
});
