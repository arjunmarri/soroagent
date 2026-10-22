// Your saved notes as knowledge: find the notes related to a page or a question (locally, no
// model needed), and present them to the model as numbered sources it must cite. Pure functions,
// unit tested; used by the panel (related notes) and the "Ask your library" page.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  // Notes worth searching: everything except screenshots (pictures, no text).
  const SEARCHABLE = new Set(['summary', 'research', 'selection', 'page', 'deliverable', 'read']);
  const kindOf = (s) => s.kind || (s.source === 'selection' ? 'selection' : s.source === 'summary' ? 'summary' : 'page');

  const STOP = new Set(('a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself '
    + 'one two three new also may like get got use used using said says say make made many much way well even still back time year years day days week weeks month months today yesterday per via etc inc com www http https html amp nbsp '
    + 'tldr key points summary worth noting page post posts thread comments article source sources')
    .split(/\s+/));

  /** Pure: lowercase word stems, without stop words and very short words. */
  function tokenize(text) {
    // Hyphens and dots split words ("multi-agent" → multi, agent); + and # stay (c++, c#).
    const words = String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9][a-z0-9+#]*/g) || [];
    const out = [];
    for (let w of words) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      // Light stemming so "agents"/"agent" and "learning"/"learned" meet.
      w = w.replace(/(ies)$/, 'y').replace(/(?<=[a-z]{3})(ing|ed|es|s)$/, '');
      if (w.length >= 3 && !STOP.has(w)) out.push(w);
    }
    return out;
  }

  // The text a note is searched by: its title and tags count most.
  function noteText(s) {
    const tags = (s.tags || []).join(' ');
    const research = s.research && s.research.text ? String(s.research.text).slice(0, 1500) : '';
    return [s.title, s.title, s.title, tags, tags, s.summary, s.summary, String(s.text || '').slice(0, 4000), research].join(' ');
  }

  /** Pure: a search index over notes: { docs: [{ note, tf, len }], df, avgLen }. */
  function buildIndex(notes) {
    const docs = [];
    const df = new Map();
    for (const note of notes || []) {
      if (!note || !SEARCHABLE.has(kindOf(note))) continue;
      const terms = tokenize(noteText(note));
      if (!terms.length) continue;
      const tf = new Map();
      for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
      docs.push({ note, tf, len: terms.length });
    }
    const avgLen = docs.reduce((n, d) => n + d.len, 0) / (docs.length || 1);
    return { docs, df, avgLen };
  }

  // The most telling words of a text (a page, a question), weighted by how often they appear.
  function queryTerms(text, max = 40) {
    const counts = new Map();
    for (const t of tokenize(text)) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  }

  /**
   * Pure: notes ranked by relevance to `text` (BM25). Options: limit, since (ISO date or ms),
   * excludeUrl (the page you're on), minMatches (distinct shared words required).
   * Returns [{ note, score, matches: [words] }].
   */
  function searchNotes(index, text, { limit = 8, since = 0, excludeUrl = '', minMatches = 1 } = {}) {
    const query = queryTerms(text);
    if (!query.length || !index.docs.length) return [];
    const N = index.docs.length;
    const sinceMs = since ? new Date(since).getTime() : 0;
    const exclude = excludeUrl && soroagent.pageKey ? soroagent.pageKey(excludeUrl) : '';
    const k1 = 1.2;
    const b = 0.75;
    const results = [];
    for (const doc of index.docs) {
      const n = doc.note;
      if (sinceMs && new Date(n.createdAt).getTime() < sinceMs) continue;
      if (exclude && n.url && soroagent.pageKey(n.url) === exclude) continue;
      let score = 0;
      const matches = [];
      for (const [term, qtf] of query) {
        const f = doc.tf.get(term);
        if (!f) continue;
        const df = index.df.get(term) || 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.len) / index.avgLen))) * Math.min(3, qtf);
        matches.push(term);
      }
      if (matches.length >= minMatches && score > 0) results.push({ note: n, score, matches });
    }
    return results.sort((x, y) => y.score - x.score).slice(0, limit);
  }

  /**
   * Pure: notes that are clearly about the same thing as a page: several distinctive shared
   * words, and a score well above the noise. At most `limit`.
   */
  function relatedNotes(index, pageText, { excludeUrl = '', limit = 3 } = {}) {
    const hits = searchNotes(index, pageText, { limit: 10, excludeUrl, minMatches: 2 });
    if (!hits.length) return [];
    // The best match must share several distinctive words; others need a fair share of its score.
    const best = hits[0];
    if (best.matches.length < 3 || best.score < 4) return [];
    return hits.filter((h) => h.score >= Math.max(1.5, best.score * 0.12)).slice(0, limit);
  }

  const dateOf = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  };
  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  /**
   * Pure: notes as a numbered block for a prompt: [S1] Title (saved 2026-10-20, site, kind) then
   * the note's text, each capped so many notes fit in the model's context.
   */
  function formatNotes(notes, { prefix = 'S', perNote = 1800, total = 16000 } = {}) {
    const blocks = [];
    let used = 0;
    notes.forEach((n, i) => {
      if (used >= total) return;
      const kind = kindOf(n);
      const label = kind === 'read' ? `read for ${Math.max(1, Math.round((n.readSeconds || 60) / 60))} min` : kind === 'page' ? 'saved page' : kind;
      const body = soroagent.stripThinking ? soroagent.stripThinking(n.text || '') : String(n.text || '');
      const research = n.research && n.research.text ? `\nResearch on it: ${String(n.research.text).slice(0, 600)}` : '';
      const text = `${n.summary ? `${n.summary}\n` : ''}${body}${research}`.replace(/\n{3,}/g, '\n\n').trim().slice(0, Math.min(perNote, total - used));
      used += text.length;
      blocks.push(`[${prefix}${i + 1}] ${n.title || n.pageTitle || 'Untitled'} (saved ${dateOf(n.createdAt)}, ${hostOf(n.url) || 'no site'}, ${label})\n${text}`);
    });
    return blocks.join('\n\n');
  }

  Object.assign(soroagent, { SEARCHABLE_KINDS: SEARCHABLE, tokenize, buildIndex, searchNotes, relatedNotes, formatNotes });
})(globalThis);
