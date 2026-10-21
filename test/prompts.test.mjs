import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, promptFiles } from './helpers.mjs';

const S = await load('shared/markdown.js', 'shared/prompts.js', ...promptFiles);

test('parseJsonLoose handles fences, chatter and think blocks', () => {
  assert.deepEqual(S.parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(S.parseJsonLoose('```json\n{"a": [1, 2]}\n```'), { a: [1, 2] });
  assert.deepEqual(S.parseJsonLoose('<think>{no}</think>Sure! {"x": [3], "note": "a } b"} done'), { x: [3], note: 'a } b' });
  assert.deepEqual(S.parseJsonLoose('I should return {"labels"} for each…\n</think>\n{"labels": {"1": "keep"}}'), { labels: { 1: 'keep' } });
  assert.equal(S.parseJsonLoose('no json here'), null);
});

test('parseSnippetMeta cleans fields and falls back to the page title', () => {
  const meta = S.parseSnippetMeta('{"title": "  Rust  async\\n", "summary": "Short.", "tags": ["#Rust", "rust", "Async", "", "a", "b"]}', 'Page');
  assert.deepEqual(meta, { title: 'Rust async', summary: 'Short.', tags: ['rust', 'async', 'a', 'b'] });
  assert.equal(S.parseSnippetMeta('oops', 'Page title').title, 'Page title');
});

test('buildMessages renders placeholders and layers default < site file < inline', () => {
  const vars = S.pageVars({ title: 'T', url: 'https://x.test', text: 'Body', truncated: true }, { context: 'CTX', count: 3 });
  const [system, user] = S.buildMessages('summarize', vars);
  assert.match(system.content, /^You are SoroAgent/);
  assert.match(user.content, /<page>\nBody\n<\/page>\n\[Content was truncated/);

  const inline = { summarize: { user: '{{context}} | {{count}} | {{content}} | {{missing}}' } };
  const [siteSystem, siteUser] = S.buildMessages('summarize', vars, inline);
  assert.equal(siteSystem.content, system.content, 'system falls back to the default');
  assert.equal(siteUser.content, 'CTX | 3 | Body |');

  // prompts/x.js overrides the user prompt for save but keeps the default system prompt.
  const x = S.promptsFor('x');
  assert.match(x.save.user, /A post from X/);
  assert.equal(x.save.system, S.promptsFor('default').save.system);
  assert.equal(S.promptsFor('x', { save: { user: 'inline' } }).save.user, 'inline');
  assert.equal(S.promptsFor('no-such-site').summarize.user, S.promptsFor('default').summarize.user);

  const ask = S.buildMessages('ask', { ...vars, question: 'Why?' });
  assert.equal(ask[1].content, 'Why?');
  assert.throws(() => S.buildMessages('nope', vars), /Unknown prompt action/);
  assert.throws(() => S.definePrompts('bad', { summarise: {} }), /unknown action "summarise"/);
});
