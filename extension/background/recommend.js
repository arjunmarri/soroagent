// Ranks installed local models for SoroAgent's work: reading a page and replying quickly with
// good instruction following and reliable JSON. Uses only what the server reports (name, size,
// capabilities), so it's a heuristic: bigger models need more memory and are slower.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});

  // Families that follow instructions and produce JSON well, best first.
  const FAMILIES = [
    { pattern: /qwen3/i, bonus: 3, name: 'Qwen 3' },
    { pattern: /gemma-?[34]/i, bonus: 3, name: 'Gemma' },
    { pattern: /qwen2\.5|qwen-2\.5/i, bonus: 2.5, name: 'Qwen 2.5' },
    { pattern: /llama-?3\.[1-9]|llama-?4/i, bonus: 2, name: 'Llama' },
    { pattern: /mistral-small|mistral-nemo|ministral/i, bonus: 2, name: 'Mistral' },
    { pattern: /phi-?4/i, bonus: 2, name: 'Phi-4' },
    { pattern: /gpt-oss/i, bonus: 2.5, name: 'gpt-oss' },
    { pattern: /granite3|granite-3|command-r/i, bonus: 1, name: '' },
  ];
  const PENALTIES = [
    { pattern: /coder|code|starcoder|codellama/i, value: 3 }, // tuned for code, weaker at prose
    { pattern: /deepseek-r1|qwq|reasoning|-r1\b/i, value: 1.5 }, // long reasoning makes replies slow
    { pattern: /llama2|llama-2|mistral:7b|mixtral|vicuna|orca-mini/i, value: 1.5 }, // older generations
    { pattern: /embed|rerank/i, value: 99 },
  ];

  /** Parameter counts in billions: total, and active (for mixture-of-experts models). */
  function parameters(model) {
    const fromSize = /([\d.]+)\s*([BM])\b/i.exec(model.size || '');
    let total = fromSize ? Number(fromSize[1]) / (fromSize[2].toUpperCase() === 'M' ? 1000 : 1) : 0;
    const experts = /(\d+)x(\d+(?:\.\d+)?)b/i.exec(model.id);
    if (!total && experts) total = Number(experts[1]) * Number(experts[2]);
    if (!total) {
      const fromName = /[:\-_](\d+(?:\.\d+)?)b\b/i.exec(model.id);
      total = fromName ? Number(fromName[1]) : 0;
    }
    const activeTag = /-a(\d+(?:\.\d+)?)b\b/i.exec(model.id); // e.g. qwen3:30b-a3b
    let active = activeTag ? Number(activeTag[1]) : total;
    if (experts && !activeTag) active = Number(experts[2]) * 2; // e.g. mixtral 8x7b uses 2 experts
    return { total, active };
  }

  function qualityScore(total) {
    if (!total) return 3; // unknown size: assume a typical mid-size model
    if (total < 2) return 0;
    if (total < 4) return 2;
    if (total < 9) return 4;
    if (total < 15) return 5;
    if (total < 36) return 6;
    if (total < 80) return 6.5;
    return 7;
  }

  function speedScore(active) {
    if (!active) return 2.5;
    if (active <= 4.5) return 4;
    if (active <= 9) return 3.5;
    if (active <= 15) return 2.5;
    if (active <= 36) return 1;
    if (active <= 80) return -1;
    return -3;
  }

  function speedLabel(active) {
    if (!active) return '';
    if (active <= 4.5) return 'very fast';
    if (active <= 9) return 'fast';
    if (active <= 15) return 'moderate speed';
    if (active <= 36) return 'slower';
    return 'slow';
  }

  function scoreModel(model) {
    if (Array.isArray(model.capabilities) && model.capabilities.length && !model.capabilities.includes('completion')) return null;
    const { total, active } = parameters(model);
    const family = FAMILIES.find((f) => f.pattern.test(model.id));
    let score = qualityScore(total) + speedScore(active) + (family ? family.bonus : 0);
    for (const penalty of PENALTIES) if (penalty.pattern.test(model.id)) score -= penalty.value;
    if (/vision|-vl\b|vl:/i.test(model.id)) score -= 0.5; // fine, but vision weights cost speed
    const moe = active && total && active < total * 0.5;
    const size = total ? `${total >= 10 ? Math.round(total) : total}B` : '';
    const reason = [
      family && family.name,
      size && (moe ? `${size} quality at ~${active}B speed` : size),
      speedLabel(active),
    ].filter(Boolean).join(' · ');
    return { id: model.id, score: Math.round(score * 10) / 10, total, active, reason };
  }

  /**
   * Up to three picks: { id, label, reason, score }. "Best for SoroAgent" is the top score;
   * "Lighter on memory" (≤ 9B total) and "Highest quality" (larger, still responsive) are added
   * when they're different models that score close to the best.
   */
  function recommendModels(models) {
    const scored = models.map(scoreModel).filter((m) => m && m.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return [];
    const best = scored[0];
    const picks = [{ ...best, label: 'Best for SoroAgent' }];
    const close = scored.filter((m) => m.id !== best.id && m.score >= best.score - 3.5);
    const light = close.find((m) => m.total && m.total <= 9 && (!best.total || best.total > 9));
    if (light) picks.push({ ...light, label: 'Lighter on memory' });
    const quality = close
      .filter((m) => m.total > (best.total || 0) && m.active <= 36 && !picks.some((p) => p.id === m.id))
      .sort((a, b) => b.score - a.score || b.total - a.total)[0];
    if (quality) picks.push({ ...quality, label: 'Highest quality' });
    return picks;
  }

  // Suggested download when nothing installed fits well.
  const PULL_SUGGESTION = { command: 'ollama pull qwen2.5:7b', reason: 'a fast, reliable all-rounder for summaries and JSON' };

  Object.assign(SoroAgent, { scoreModel, recommendModels, modelParameters: parameters, PULL_SUGGESTION });
})(globalThis);
