import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './helpers.mjs';

// Keeps the published downloads, the README links and the extension version in step.
const version = JSON.parse(readFileSync(join(root, 'extension/manifest.json'), 'utf8')).version;
const readme = readFileSync(join(root, 'README.md'), 'utf8');

test('package.json and the manifest have the same version', () => {
  assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version, version);
});

test('downloads/ holds exactly the current version for each browser', () => {
  const files = readdirSync(join(root, 'downloads')).filter((f) => f.endsWith('.zip')).sort();
  assert.deepEqual(files, [`soroagent-chrome-${version}.zip`, `soroagent-firefox-${version}.zip`], 'run: npm run downloads');
});

test('README download links and version line point at the current version', () => {
  const links = [...readme.matchAll(/soroagent-(?:chrome|firefox)[\w.-]*\.zip/g)].map((m) => m[0]);
  assert.ok(links.length >= 4, 'README has download links');
  for (const link of links) assert.match(link, new RegExp(`-${version.replace(/\./g, '\\.')}\\.zip$`), `${link} should be v${version} (run: npm run downloads)`);
  assert.ok(readme.includes(`Current version: **v${version}**`), 'README version line');
  for (const link of new Set(links)) assert.ok(existsSync(join(root, 'downloads', link)), `downloads/${link} exists`);
});
