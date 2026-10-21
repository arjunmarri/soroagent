import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('background/research.js');

test('DuckDuckGo lite results: real links decoded, ads and duplicates skipped', () => {
  const html = `
    <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsqlite.org%2Fwal.html&amp;rut=1" class='result-link'>Write-Ahead Logging &amp; more</a>
    <td class='result-snippet'>How <b>WAL</b> works.</td>
    <a rel="nofollow" href="https://duckduckgo.com/y.js?ad_domain=ads.example&amp;u3=x" class='result-link'>Sponsored</a>
    <td class='result-snippet'>Ad</td>
    <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsqlite.org%2Fwal.html&amp;rut=2" class='result-link'>Duplicate</a>
    <a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fb&amp;rut=3" class='result-link'>Second</a>`;
  const results = S.parseDuckDuckGoLite(html);
  assert.deepEqual(results.map((r) => r.url), ['https://sqlite.org/wal.html', 'https://example.com/b']);
  assert.equal(results[0].title, 'Write-Ahead Logging & more');
  assert.equal(results[0].snippet, 'How WAL works.');
});

test('SearXNG JSON results', () => {
  assert.deepEqual(S.parseSearx({ results: [{ url: 'https://a.test', title: 'A', content: 'x' }, { url: 'javascript:alert(1)' }] }), [{ url: 'https://a.test', title: 'A', snippet: 'x' }]);
});

test('htmlToText keeps the article and drops chrome, scripts and menus', () => {
  const html = `<html><head><title>Guide &mdash; Site</title><script>var x = "<p>nope</p>";</script></head><body>
    <nav><a>Home</a><a>Docs</a></nav><header><p>Site header text that is long enough to count as a paragraph.</p></header>
    <main><h1>WAL mode</h1><p>Readers no longer block writers, and writers no longer block readers in WAL mode at all.</p>
    <ul><li>Docs</li><li>Use PRAGMA busy_timeout to retry when the database is locked.</li></ul>
    <p>${'Long content. '.repeat(120)}</p></main><footer><p>Copyright footer text that should never appear in output.</p></footer></body></html>`;
  const { title, text } = S.htmlToText(html, 4000);
  assert.equal(title, 'Guide — Site');
  assert.match(text, /^## WAL mode\nReaders no longer block writers/);
  assert.match(text, /- Use PRAGMA busy_timeout/);
  assert.doesNotMatch(text, /nope|Site header|Copyright|^- Docs$/m);
  assert.ok(text.length <= 4000);
});

test('formatSources numbers sources with their URLs', () => {
  assert.equal(S.formatSources([{ title: 'A', url: 'https://a.test', text: 'aa' }]), '[1] A\nURL: https://a.test\naa');
});

test('Brave and Bing results (fallback engines)', () => {
  const brave = `<div class="snippet svelte-x" data-type="web"><a href="https://www.sqlite.org/wal.html" target="_self" class="l1"><div class="title svelte-x">Write-Ahead <b>Logging</b></div></a><div class="snippet-description svelte-y">One writer at a time.</div></div>
    <div data-type="web"><a href="https://search.brave.com/settings">x</a></div>`;
  assert.deepEqual(S.parseBrave(brave), [{ url: 'https://www.sqlite.org/wal.html', title: 'Write-Ahead Logging', snippet: 'One writer at a time.' }]);
  const target = Buffer.from('https://sqlite.org/wal.html').toString('base64url');
  const bing = `<li class="b_algo" data-id><h2 class=""><a target="_blank" href="https://www.bing.com/ck/a?!&amp;&amp;p=1&amp;u=a1${target}&amp;ntb=1" h="ID">Write-Ahead Logging</a></h2><div class="b_caption"><p class="b_lineclamp2">WAL lets readers continue.</p></div></li>`;
  assert.deepEqual(S.parseBing(bing), [{ url: 'https://sqlite.org/wal.html', title: 'Write-Ahead Logging', snippet: 'WAL lets readers continue.' }]);
});
