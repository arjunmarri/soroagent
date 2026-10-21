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

test('parseAiCheck reads percentages, fractions and verdicts', () => {
  const r = S.parseAiCheck('{"ai_probability": 82, "confidence": "High", "signals": ["stock phrases", "  no specifics "]}');
  assert.deepEqual(r, { aiPercent: 82, verdict: 'ai', confidence: 'high', signals: ['stock phrases', 'no specifics'] });
  assert.equal(S.parseAiCheck('{"ai_probability": 0.25}').aiPercent, 25);
  assert.equal(S.parseAiCheck('{"ai_probability": "55%"}').verdict, 'mixed');
  assert.equal(S.parseAiCheck('{"ai_probability": 140, "confidence": "certain"}').aiPercent, 100);
  assert.equal(S.parseAiCheck('{"ai_probability": 10, "confidence": "certain"}').confidence, 'low');
  assert.equal(S.parseAiCheck('{"verdict": "ai"}'), null);
  assert.equal(S.parseAiCheck('nope'), null);
});

test('parseAiScores maps per-item scores to valid ids only', () => {
  const scores = S.parseAiScores('{"scores": {"1": {"ai": 91, "why": "thread-bait hook"}, "2": 12, "3": {"ai": "x"}, "9": {"ai": 50}}}', [1, 2, 3]);
  assert.deepEqual([...scores.entries()], [[1, { ai: 91, why: 'thread-bait hook' }], [2, { ai: 12, why: '' }]]);
  const bracketed = S.parseAiScores('{"scores": {"[1]": {"ai": 80}, "#2": {"ai": 5}, "3.": 40}}', [1, 2, 3]);
  assert.deepEqual([...bracketed.keys()], [1, 2, 3]);
  const list = S.parseAiScores('{"scores": [{"id": 2, "ai": 0.9}, {"id": 1, "ai": 10}]}', [1, 2]);
  assert.deepEqual([list.get(1).ai, list.get(2).ai], [10, 90]);
  assert.equal(S.parseAiScores('{"1": {"ai": 77}}', [1]).get(1).ai, 77);
  assert.equal(S.verdictFor(70), 'ai');
  assert.equal(S.verdictFor(30), 'human');
  assert.equal(S.verdictFor(50), 'mixed');
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

  // prompts/x.js overrides the system prompt but keeps the default JSON user prompt for aiCheckItems.
  const x = S.promptsFor('x');
  assert.match(x.aiCheckItems.system, /thread-bait hooks/);
  assert.equal(x.aiCheckItems.user, S.promptsFor('default').aiCheckItems.user);
  assert.equal(S.promptsFor('x', { save: { user: 'inline' } }).save.user, 'inline');
  assert.equal(S.promptsFor('no-such-site').summarize.user, S.promptsFor('default').summarize.user);

  const ask = S.buildMessages('ask', { ...vars, question: 'Why?' });
  assert.equal(ask[1].content, 'Why?');
  assert.throws(() => S.buildMessages('nope', vars), /Unknown prompt action/);
  assert.throws(() => S.definePrompts('bad', { summarise: {} }), /unknown action "summarise"/);
});
