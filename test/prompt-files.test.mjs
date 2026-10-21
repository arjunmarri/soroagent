import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load, promptFiles, root } from './helpers.mjs';

// Checks every file in extension/prompts so contributors get a clear failure, not a broken extension.
const siteFiles = readdirSync(join(root, 'extension/sites')).filter((f) => f.endsWith('.js') && !f.startsWith('_') && f !== 'registry.js');
const S = await load('shared/markdown.js', 'shared/prompts.js', ...promptFiles, 'sites/registry.js', ...siteFiles.map((f) => `sites/${f}`));

const setIds = promptFiles.map((f) => f.replace(/^prompts\/|\.js$/g, ''));
const JSON_SHAPES = { save: ['"title"', '"summary"', '"tags"'] };

test('there is a default prompt set covering every action', () => {
  const defaults = S.promptsFor('default');
  for (const action of S.PROMPT_ACTIONS) assert.ok(defaults[action] && (defaults[action].system || defaults[action].user), `default.${action}`);
  assert.ok(defaults.persona, 'default persona');
});

// Each prompt set, plus each of its page-type variants (e.g. reddit/thread).
const variants = setIds.flatMap((id) => {
  const pages = Object.keys(S.promptSet(id).pages || {});
  return [[id, undefined], ...pages.map((page) => [id, page])];
});

for (const [id, page] of variants) {
  test(`prompts/${id}.js${page ? ` (${page} pages)` : ''} uses only known placeholders and keeps JSON reply shapes`, () => {
    const set = S.promptsFor(id, null, page);
    for (const action of S.PROMPT_ACTIONS) {
      for (const field of ['system', 'user']) {
        const text = (set[action] && set[action][field]) || '';
        for (const [, name] of text.matchAll(/\{\{(\w+)\}\}/g)) {
          assert.ok(S.PROMPT_PLACEHOLDERS.includes(name), `${id}.${action}.${field}: unknown placeholder {{${name}}}`);
        }
      }
      if (JSON_SHAPES[action]) {
        const whole = `${set[action].system || ''}\n${set[action].user || ''}`;
        assert.match(whole, /JSON/, `${id}.${action} must ask for JSON`);
        for (const key of JSON_SHAPES[action]) assert.ok(whole.includes(key), `${id}.${action} must keep the ${key} field`);
      }
    }
  });
}

test('every site prompt file belongs to a site profile', () => {
  const siteIds = S.siteProfiles.map((p) => p.id);
  for (const id of setIds.filter((i) => i !== 'default')) assert.ok(siteIds.includes(id), `prompts/${id}.js has no site profile with id "${id}"`);
});
