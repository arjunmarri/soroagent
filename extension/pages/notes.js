// "Ask your notes": questions across the user's saved notes (synthesis), and deliverables made
// from them. The notes are found locally (shared/knowledge.js); only the ones used are sent to the
// model, numbered [S1]… so every claim can be traced back. The prompts keep "what your sources
// say" apart from "my interpretation".
(function () {
  'use strict';

  const S = globalThis.soroagent;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  // What each "Create" button makes: its title and the format the model follows.
  const MAKE = {
    brief: { label: 'Research brief', format: 'A research brief. Sections: **Summary** (3 sentences), **Key findings** (bullets, each cited), **Where sources disagree**, **Open questions**, **Analysis** (your interpretation, labeled as such).' },
    decision: { label: 'Technical decision', format: 'A technical decision record. Sections: **Context**, **Options considered** (each with evidence from the notes, cited), **Trade-offs** (a short comparison), **Recommendation** (your interpretation, with reasons), **Risks and unknowns**.' },
    study: { label: 'Study guide', format: 'A study guide. Sections: **Core concepts** (cited), **Key facts to remember**, **Common confusions**, **Practice questions** (5, with short answers), **Further reading** (from the notes, by [S#]).' },
    draft: { label: 'Draft', format: 'A draft article in clear, engaging prose (300 to 600 words) with a title. Cite claims from the notes with [S#]. End with **Notes on sources**: which parts are your own framing or opinion.' },
  };
  const MAX_NOTES = 12;

  let notes = [];
  let running = null;
  let last = null; // { title, question, text, used: [notes], kind }

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const sinceMs = () => {
    const days = Number($('range').value);
    return days ? Date.now() - days * 86400000 : 0;
  };
  const rangeText = () => $('range').selectedOptions[0].textContent;

  async function load() {
    notes = (await S.listSnippets()).filter((n) => S.SEARCHABLE_KINDS.has(n.kind || 'page'));
    showScope();
  }
  function showScope() {
    const since = sinceMs();
    const count = notes.filter((n) => !since || new Date(n.createdAt).getTime() >= since).length;
    $('scope').textContent = `${count} saved note${count === 1 ? '' : 's'} from ${rangeText()}`;
  }

  // The notes to use: the most relevant to the question in the time range, topped up with the
  // most recent ones when the question is broad ("what have I learned this month?").
  function pickNotes(question) {
    const since = sinceMs();
    const inRange = notes.filter((n) => !since || new Date(n.createdAt).getTime() >= since);
    const hits = S.searchNotes(S.buildIndex(inRange), question, { limit: MAX_NOTES, minMatches: 1 }).map((h) => h.note);
    if (hits.length >= 3) return hits;
    const recent = inRange.filter((n) => !hits.includes(n)).slice(0, MAX_NOTES - hits.length);
    return [...hits, ...recent];
  }

  // Markdown with [S1]-style citations turned into links to the source list below.
  function render(text, used) {
    let html = S.renderMarkdown(S.stripThinking(text || ''));
    html = html.replace(/\[S(\d{1,2})\]/g, (m, n) => (used[Number(n) - 1] ? `<a class="cite" href="#src-${n}" title="${S.escapeHtml(used[Number(n) - 1].title || '')}">S${n}</a>` : m));
    return [...new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes];
  }

  function sourceList(used) {
    return el('div', { className: 'sources' }, [
      el('h3', { textContent: `Sources used (${used.length} of your notes)` }),
      el('ol', {}, used.map((n, i) => el('li', { id: `src-${i + 1}` }, [
        el('span', { className: 'n', textContent: `S${i + 1}` }),
        el('a', { href: `snippets.html#${encodeURIComponent(n.id)}`, textContent: n.title || n.pageTitle || 'Untitled', title: 'Open this note' }),
        el('small', { textContent: [day(n.createdAt), hostOf(n.url), n.kind === 'readlater' ? (n.readAt ? 'read later · read' : 'read later · not read yet') : n.kind].filter(Boolean).join(' · ') }),
      ]))),
    ]);
  }

  async function run({ question, make }) {
    if (running) running.abort();
    const topic = question.trim();
    if (!topic) {
      $('question').focus();
      $('question').placeholder = make ? `What should the ${MAKE[make].label.toLowerCase()} be about? e.g. Choosing a vector database` : 'Type a question first.';
      return;
    }
    const used = pickNotes(topic);
    const out = $('output');
    if (!used.length) {
      out.replaceChildren(el('div', { className: 'empty', textContent: `You haven't saved any notes from ${rangeText()} yet. Summarize a few pages (they're saved automatically), or choose a longer time range.` }));
      return;
    }
    const title = make ? `${MAKE[make].label}: ${topic}` : topic;
    const body = el('div', { className: 'prose' });
    const status = el('div', { className: 'working', textContent: `Reading ${used.length} of your notes…` });
    const stop = el('button', { type: 'button', className: 'btn small', textContent: 'Stop' });
    out.replaceChildren(el('div', { className: 'box output' }, [
      el('h2', { textContent: title }),
      el('div', { className: 'meta', textContent: `From ${used.length} of your saved notes · ${rangeText()}` }),
      status,
      body,
      sourceList(used),
      el('div', { className: 'actions' }, [stop]),
    ]));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const vars = { content: S.formatNotes(used), question: make ? `${MAKE[make].label} about: ${topic}` : topic, context: make ? MAKE[make].format : `The notes are from ${rangeText()}.` };
    const settings = await S.getSettings();
    const persona = S.customPersona(settings, 'default');
    const messages = S.buildMessages(make ? 'deliverable' : 'synthesize', vars, persona ? { persona } : null);
    const controller = new AbortController();
    running = controller;
    stop.addEventListener('click', () => controller.abort());
    let text = '';
    let frame = 0;
    try {
      const reply = await S.askModel(messages, {
        signal: controller.signal,
        onToken: (t) => {
          text += t;
          status.textContent = 'Writing…';
          if (!frame) frame = requestAnimationFrame(() => ((frame = 0), body.replaceChildren(...render(text, used))));
        },
      });
      text = reply || text;
      status.remove();
      body.replaceChildren(...render(text, used));
      last = { title, question: topic, text, used, kind: make || 'answer' };
      stop.replaceWith(...finishedActions());
    } catch (err) {
      status.className = err.name === 'AbortError' ? 'muted' : 'problem';
      status.textContent = err.name === 'AbortError' ? 'Stopped.' : `${err.message}${err.hint ? ` ${err.hint}` : ''}`;
      stop.remove();
    } finally {
      if (running === controller) running = null;
    }
  }

  function markdownExport() {
    const sources = last.used.map((n, i) => `[S${i + 1}] ${n.title || 'Untitled'}${n.url ? ` — ${n.url}` : ''} (saved ${day(n.createdAt)})`).join('\n');
    return `# ${last.title}\n\n${S.stripThinking(last.text)}\n\n## Sources\n${sources}\n`;
  }

  function finishedActions() {
    const save = el('button', { type: 'button', className: 'btn primary', textContent: 'Save to snippets' });
    save.addEventListener('click', async () => {
      const snippet = await S.addSnippet({
        kind: 'deliverable',
        source: 'notes',
        title: last.title.slice(0, 160),
        summary: S.stripThinking(last.text).replace(/[*_#>`[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220),
        text: `${S.stripThinking(last.text)}\n\n**Sources**\n${last.used.map((n, i) => `- [S${i + 1}] ${n.title || 'Untitled'}${n.url ? ` (${n.url})` : ''}`).join('\n')}`,
        tags: ['from-notes'],
        sourceIds: last.used.map((n) => n.id),
      });
      save.textContent = 'Saved';
      save.disabled = true;
      save.after(el('a', { className: 'btn', href: `snippets.html#${encodeURIComponent(snippet.id)}`, textContent: 'Open in snippets' }));
    });
    const copy = el('button', { type: 'button', className: 'btn', textContent: 'Copy' });
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(markdownExport());
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    });
    const download = el('button', { type: 'button', className: 'btn', textContent: 'Download .md' });
    download.addEventListener('click', () => {
      const url = URL.createObjectURL(new Blob([markdownExport()], { type: 'text/markdown' }));
      el('a', { href: url, download: `${last.title.replace(/[^\w -]+/g, '').trim().slice(0, 60) || 'soroagent'}.md` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    return [save, copy, download];
  }

  // Suggested questions fill the box and select the part to replace ("[topic]").
  $('suggest').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (!chip) return;
    const q = chip.dataset.q;
    const box = $('question');
    const current = box.value.trim();
    // Reuse a topic that's already typed.
    box.value = current && !/\?$/.test(current) ? q.replace(/\[(topic|argument)\]/, current) : q;
    if (chip.dataset.range) $('range').value = chip.dataset.range;
    showScope();
    const start = box.value.indexOf('[');
    box.focus();
    if (start >= 0) box.setSelectionRange(start, box.value.indexOf(']', start) + 1);
  });
  $('create').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-make]');
    if (chip) run({ question: $('question').value, make: chip.dataset.make });
  });
  $('ask').addEventListener('click', () => run({ question: $('question').value }));
  $('question').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      run({ question: $('question').value });
    }
  });
  $('range').addEventListener('change', showScope);

  // notes.html?topic=… (from the panel) starts with that topic.
  const topic = new URLSearchParams(location.search).get('topic');
  if (topic) $('question').value = `What have I learned about ${topic.slice(0, 120)}?`;
  load();
})();
