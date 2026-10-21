import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  ];
  for (const file of files) assert.ok(existsSync(join(ext, file)), `missing ${file}`);
});

test('the Chrome service worker loads the same scripts as Firefox, in order', () => {
  const sw = readFileSync(join(ext, manifest.background.service_worker), 'utf8');
  const imported = [...sw.matchAll(/'([^']+\.js)'/g)].map((m) => join('background', m[1]));
  assert.deepEqual(imported.map((p) => join(ext, p)), manifest.background.scripts.map((p) => join(ext, p)));
});

test('pages only load scripts that exist', () => {
  for (const page of ['options', 'snippets', 'history']) {
    const html = readFileSync(join(ext, 'pages', `${page}.html`), 'utf8');
    for (const [, src] of html.matchAll(/<script src="([^"]+)"/g)) {
      assert.ok(existsSync(join(ext, 'pages', src)), `${page}.html -> ${src}`);
    }
  }
});

test('content scripts load the site registry before the site profiles and the assistant last', () => {
  const js = expandScripts(manifest.content_scripts[0].js, ext);
  const registry = js.indexOf('sites/registry.js');
  const x = js.indexOf('sites/x.js');
  assert.ok(registry >= 0 && x > registry, 'registry before profiles');
  assert.ok(js.indexOf('shared/prompts.js') < js.indexOf('prompts/default.js'), 'prompt engine before prompt files');
  assert.ok(js.includes('prompts/x.js'), 'site prompt files are loaded');
  assert.ok(!js.some((f) => f.includes('_template')), 'templates are not loaded');
  assert.equal(js.at(-1), 'content/assistant.js');
});
