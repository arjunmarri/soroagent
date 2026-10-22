import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './helpers.mjs';
import { expandScripts } from '../scripts/manifest-utils.mjs';

const ext = join(root, 'extension');
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));

test('every file the manifest references exists', () => {
  const files = [
    manifest.background.service_worker,
    ...manifest.background.scripts,
    ...manifest.content_scripts.flatMap((c) => expandScripts(c.js, ext)),
    manifest.options_ui.page,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...Object.values(manifest.icons).map((p) => p.replace('icons/', 'icons/dark/')),
  ];
  for (const file of files) assert.ok(existsSync(join(ext, file)), `missing ${file}`);
});

test('the Chrome service worker loads the same scripts as Firefox, in order', () => {
  const sw = readFileSync(join(ext, manifest.background.service_worker), 'utf8');
  const imported = [...sw.matchAll(/'([^']+\.js)'/g)].map((m) => join('background', m[1]));
  assert.deepEqual(imported.map((p) => join(ext, p)), manifest.background.scripts.map((p) => join(ext, p)));
});

test('pages only load scripts that exist', () => {
  for (const page of ['options', 'snippets', 'history', 'onboard']) {
    const html = readFileSync(join(ext, 'pages', `${page}.html`), 'utf8');
    for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
      assert.ok(existsSync(join(ext, 'pages', src)), `${page}.html -> ${src}`);
    }
  }
});

test('content scripts load the site registry before the site profiles and the assistant last', () => {
  const main = manifest.content_scripts.find((script) => script.js.includes('content/assistant.js'));
  const js = expandScripts(main.js, ext);
  const registry = js.indexOf('sites/registry.js');
  const x = js.indexOf('sites/x.js');
  assert.ok(registry >= 0 && x > registry, 'registry before profiles');
  assert.ok(js.indexOf('shared/prompts.js') < js.indexOf('prompts/default.js'), 'prompt engine before prompt files');
  assert.ok(js.includes('prompts/x.js'), 'site prompt files are loaded');
  assert.ok(!js.some((f) => f.includes('_template')), 'templates are not loaded');
  assert.equal(js.at(-1), 'content/assistant.js');
});

test('pages that build prompts load every prompt file', () => {
  const files = readdirSync(join(ext, 'prompts')).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  for (const page of ['options', 'snippets']) {
    const html = readFileSync(join(ext, 'pages', `${page}.html`), 'utf8');
    for (const file of files) assert.ok(html.includes(`../prompts/${file}`), `${page}.html loads prompts/${file}`);
  }
});

test('the shared settings script loads cleanly on an extension page', async () => {
  // Regression: a const used before its definition broke every soroagent page.
  const { runInNewContext } = await import('node:vm');
  const links = [{ href: '' }];
  const fakeChrome = { runtime: { getManifest: () => ({ version: '9.9.9' }), sendMessage: () => Promise.resolve() }, storage: { local: {} } };
  const context = {
    chrome: fakeChrome,
    navigator: { userAgent: 'Chrome' },
    location: { protocol: 'chrome-extension:', pathname: '/pages/stats.html' },
    document: { querySelectorAll: () => links },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    URLSearchParams,
  };
  context.globalThis = context;
  runInNewContext(readFileSync(join(ext, 'shared/config.js'), 'utf8'), context);
  assert.ok(context.soroagent && context.soroagent.ext, 'config.js finished and exported ext');
  assert.match(links[0].href, /^https:\/\/soroagent\.com\/feedback\?v=9\.9\.9&browser=chrome&from=stats$/);
});

test('only http(s) links are made clickable', async () => {
  const { runInNewContext } = await import('node:vm');
  const context = { chrome: { runtime: {}, storage: {} } };
  context.globalThis = context;
  runInNewContext(readFileSync(join(ext, 'shared/config.js'), 'utf8'), context);
  const { safeUrl } = context.soroagent;
  assert.equal(safeUrl('https://a.com/x'), 'https://a.com/x');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<b>x', '', undefined]) assert.equal(safeUrl(bad), '#');
});
