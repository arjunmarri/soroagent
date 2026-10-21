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
  for (const page of ['options', 'snippets', 'history', 'stats']) {
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

test('dark mode loads on its own at document_start so pages never flash white', () => {
  const dark = manifest.content_scripts.find((script) => script.js.includes('content/dark.js'));
  assert.equal(dark.run_at, 'document_start');
  assert.deepEqual(dark.js, ['content/dark.js']);
});

test('pages that build prompts load every prompt file', () => {
  const files = readdirSync(join(ext, 'prompts')).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  for (const page of ['options', 'snippets']) {
    const html = readFileSync(join(ext, 'pages', `${page}.html`), 'utf8');
    for (const file of files) assert.ok(html.includes(`../prompts/${file}`), `${page}.html loads prompts/${file}`);
  }
});
