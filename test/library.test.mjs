import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('shared/markdown.js', 'shared/snippets.js', 'shared/knowledge.js', 'background/llm.js', 'background/library.js');

test('vectors pack to about a byte per dimension and keep their direction', () => {
  const v = Array.from({ length: 768 }, (_, i) => Math.sin(i));
  const packed = S.packVector(v);
  assert.ok(packed.length < 1100, `${packed.length} chars`);
  const back = S.unpackVector(packed);
  const norm = Math.hypot(...v);
  const exact = v.map((x) => x / norm);
  assert.ok(S.cosine(back, Float32Array.from(exact)) > 0.999);
});

test('rankings by meaning and by words are fused, rewarding agreement', () => {
  const fused = S.fuseRankings({ meaning: ['a', 'b', 'c'], words: ['c', 'd'] });
  assert.equal(fused[0].id, 'c', 'found both ways ranks first');
  assert.deepEqual([...fused[0].by].sort(), ['meaning', 'words']);
  assert.deepEqual(fused.map((f) => f.id).sort(), ['a', 'b', 'c', 'd']);
});

test('notes are re-embedded only when their text changes', () => {
  const note = { title: 'Agents', tags: ['ai'], summary: 's', text: 't' };
  assert.equal(S.hashText(S.embedText(note)), S.hashText(S.embedText({ ...note })));
  assert.notEqual(S.hashText(S.embedText(note)), S.hashText(S.embedText({ ...note, summary: 'changed' })));
  assert.match(S.embedText(note), /^Agents\n#ai\ns\nt$/);
});

test('the best installed Ollama embedding model is picked', () => {
  assert.equal(S.pickOllamaEmbedding([{ id: 'llama3.2' }, { id: 'all-minilm:latest' }, { id: 'nomic-embed-text:latest' }]), 'nomic-embed-text:latest');
  assert.equal(S.pickOllamaEmbedding([{ id: 'llama3.2' }, { id: 'qwen3:8b' }]), '');
  assert.equal(S.pickOllamaEmbedding([{ id: 'custom', capabilities: ['embedding'] }]), 'custom');
});

test('search uses meaning when an embedding model exists, words otherwise', async () => {
  const notes = {
    'snippet:a': { id: 'a', kind: 'summary', title: 'Training dogs to sit', text: 'Positive reinforcement for puppies.', tags: [], createdAt: '2026-10-01T00:00:00Z', url: 'https://a.example/' },
    'snippet:b': { id: 'b', kind: 'summary', title: 'Sourdough starter', text: 'Flour and water fermentation.', tags: [], createdAt: '2026-10-02T00:00:00Z', url: 'https://b.example/' },
  };
  const store = { ...notes };
  const ext = { storage: { local: {
    get: async () => ({ ...store }),
    set: async (o) => Object.assign(store, o),
    remove: async (keys) => [].concat(keys).forEach((k) => delete store[k]),
  } } };
  // A toy embedding: dimension 0 = "about pets", dimension 1 = "about baking".
  const embed = async (_t, texts) => texts.map((t) => (/dog|pupp|pet|canine/i.test(t) ? [1, 0.05] : /bread|sourdough|flour|bak/i.test(t) ? [0.05, 1] : [0.5, 0.5]));
  const lib = S.createLibrary({ ext, getTarget: async () => ({ kind: 'ollama', model: 'toy' }), embed });
  const res = await lib.search('how do I teach my canine companion manners');
  assert.equal(res.mode, 'meaning');
  assert.equal(res.results[0].note.id, 'a', 'found by meaning with no shared words');
  assert.ok(Object.keys(store).some((k) => k.startsWith('vec:')), 'vectors are stored');
  const wordsOnly = S.createLibrary({ ext, getTarget: async () => null, embed });
  const res2 = await wordsOnly.search('sourdough');
  assert.equal(res2.mode, 'words');
  assert.equal(res2.results[0].note.id, 'b');
});
