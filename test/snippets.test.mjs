import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/snippets.js');

test('the same page matches with or without a #fragment or trailing slash', () => {
  assert.equal(S.pageKey('https://a.com/post/1/#comments'), S.pageKey('https://a.com/post/1'));
  assert.notEqual(S.pageKey('https://a.com/post/1'), S.pageKey('https://a.com/post/2'));
  assert.notEqual(S.pageKey('https://a.com/search?q=x'), S.pageKey('https://a.com/search?q=y'));
  assert.equal(S.pageKey('not a url'), 'not a url');
});

test('auto-tags reuse the library vocabulary, whatever their spelling', () => {
  const library = [{ tags: ['ai-agents', 'llm'] }, { tags: ['ai-agents'] }, { tags: ['cooking'] }];
  const vocab = S.tagVocabulary(library);
  assert.deepEqual(vocab.map((v) => v.tag), ['ai-agents', 'cooking', 'llm']);
  assert.deepEqual(S.canonicalTags(['AI Agents', '#ai_agent', 'LLMs', 'robotics', 'Robotics'], vocab), ['ai-agents', 'llm', 'robotics']);
  assert.equal(S.normalizeTag('  Machine Learning! '), 'machine-learning');
});
