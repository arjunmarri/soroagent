import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('background/recommend.js');
const m = (id, size = '', capabilities = ['completion']) => ({ id, size, capabilities });

test('parameter counts come from the size, the name, or mixture-of-experts tags', () => {
  assert.deepEqual(S.modelParameters(m('qwen3:30b-a3b', '30.5B')), { total: 30.5, active: 3 });
  assert.deepEqual(S.modelParameters(m('llama3.2:3b')), { total: 3, active: 3 });
  assert.deepEqual(S.modelParameters(m('mixtral:8x7b')), { total: 56, active: 14 });
  assert.deepEqual(S.modelParameters(m('tiny', '567M')), { total: 0.567, active: 0.567 });
});

test('ranking prefers modern instruction models of a practical size', () => {
  const models = [
    m('qwen2.5-coder:7b', '7.6B'),
    m('llama3.3:70b', '70.6B'),
    m('qwen3:30b-a3b', '30.5B'),
    m('gemma4:latest', '8.0B'),
    m('deepseek-r1:70b', '70.6B'),
    m('nomic-embed-text', '137M', ['embedding']),
  ];
  const picks = S.recommendModels(models);
  assert.equal(picks[0].id, 'qwen3:30b-a3b');
  assert.equal(picks[0].label, 'Best for SoroAgent');
  assert.match(picks[0].reason, /quality at ~3B speed/);
  assert.ok(picks.some((p) => p.id === 'gemma4:latest' && p.label === 'Lighter on memory'));
  assert.ok(!picks.some((p) => /coder|r1|embed/.test(p.id)));
  assert.equal(S.scoreModel(m('nomic-embed-text', '137M', ['embedding'])), null);
});

test('no recommendations when nothing usable is installed', () => {
  assert.deepEqual(S.recommendModels([]), []);
  assert.deepEqual(S.recommendModels([m('all-minilm', '23M', ['embedding'])]), []);
  assert.match(S.PULL_SUGGESTION.command, /^ollama pull /);
});
