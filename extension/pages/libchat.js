// "Ask your library": a chat console docked at the bottom of the snippets and summary history
// pages. It answers from everything saved (found by meaning and words in the library index), keeps
// a conversation with follow-ups, can make deliverables, and keeps "what your sources say"
// (cited [S1]…) apart from "my interpretation". Mount it with soroagent.mountLibraryChat().
(function (root) {
  'use strict';

  const S = root.soroagent;
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  // What each "Create" option makes: its title and the format the model follows.
  const MAKE = {
    brief: { label: 'Research brief', format: 'A research brief. Sections: **Summary** (3 sentences), **Key findings** (bullets, each cited), **Where sources disagree**, **Open questions**, **Analysis** (your interpretation, labeled as such).' },
    decision: { label: 'Technical decision', format: 'A technical decision record. Sections: **Context**, **Options considered** (each with evidence from the notes, cited), **Trade-offs** (a short comparison), **Recommendation** (your interpretation, with reasons), **Risks and unknowns**.' },
    study: { label: 'Study guide', format: 'A study guide. Sections: **Core concepts** (cited), **Key facts to remember**, **Common confusions**, **Practice questions** (5, with short answers), **Further reading** (from the notes, by [S#]).' },
    draft: { label: 'Draft', format: 'A draft article in clear, engaging prose (300 to 600 words) with a title. Cite claims from the notes with [S#]. End with **Notes on sources**: which parts are your own framing or opinion.' },
  };
  const SUGGEST = [
    ['What have I learned about…?', 'What have I learned about [topic] over the past month?', 30],
    ['Where do my sources disagree?', 'Where do my saved sources disagree about [topic]?'],
    ['What evidence supports…?', 'What evidence supports this argument: [argument]?'],
    ['What should I read next?', 'What should I read next about [topic]?'],
    ['What can I conclude?', 'What conclusions can I draw from these sources about [topic]?'],
  ];
  const MAX_NOTES = 12;

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const day = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  /**
   * Mounts the console. options: { getFocus: () => note | null (the note open on the page),
   * placeholder }. Returns { open(question), ask(question) }.
   */
  function mountLibraryChat({ getFocus = () => null, placeholder = 'Ask your library…' } = {}) {
    let turns = []; // [{ question, answer }]
    let running = null;
    let focusOn = false;

    const range = el('select', { className: 'lc-range', title: 'Which notes to use' }, [
      el('option', { value: '7', textContent: 'Past week' }),
      el('option', { value: '30', textContent: 'Past month', selected: true }),
      el('option', { value: '90', textContent: 'Past 3 months' }),
      el('option', { value: '0', textContent: 'All time' }),
    ]);
    range.setAttribute('aria-label', 'Which notes to use');
    const mode = el('span', { className: 'lc-mode' });
    const newChat = el('button', { type: 'button', className: 'lc-icon', textContent: 'New chat', hidden: true });
    const close = el('button', { type: 'button', className: 'lc-icon', textContent: '×', title: 'Minimize (Esc)' });
    close.setAttribute('aria-label', 'Minimize');
    const log = el('div', { className: 'lc-log', role: 'log' });
    log.setAttribute('aria-live', 'polite');
    const suggest = el('div', { className: 'lc-start' }, [
      el('p', { className: 'lc-intro', textContent: 'Chat with everything you\'ve read and saved. Answers cite your notes as [S1], [S2]… and keep what your sources say apart from the AI\'s interpretation.' }),
      el('div', { className: 'lc-chips' }, SUGGEST.map(([label, q, days]) => {
        const b = el('button', { type: 'button', className: 'lc-chip', textContent: label });
        b.addEventListener('click', () => fill(q, days));
        return b;
      })),
      el('div', { className: 'lc-label', textContent: 'Create from your notes' }),
      el('div', { className: 'lc-chips' }, Object.entries(MAKE).map(([id, m]) => {
        const b = el('button', { type: 'button', className: 'lc-chip make', textContent: m.label });
        b.addEventListener('click', () => run({ question: input.value, make: id }));
        return b;
      })),
    ]);
    const sheet = el('div', { className: 'lc-sheet', hidden: true }, [
      el('div', { className: 'lc-head' }, [el('b', { textContent: '✦ Ask your library' }), range, mode, el('span', { className: 'lc-grow' }), newChat, close]),
      el('div', { className: 'lc-body' }, [suggest, log]),
    ]);
    const focusChip = el('button', { type: 'button', className: 'lc-focus', hidden: true });
    focusChip.setAttribute('aria-pressed', 'false');
    const input = el('textarea', { className: 'lc-input', rows: 1, placeholder });
    input.setAttribute('aria-label', 'Ask your library');
    const send = el('button', { type: 'button', className: 'lc-send', textContent: '↑', title: 'Ask (Enter)' });
    send.setAttribute('aria-label', 'Ask');
    const bar = el('div', { className: 'lc-bar' }, [el('span', { className: 'lc-spark', textContent: '✦' }), focusChip, input, send]);
    const dock = el('div', { className: 'lc-dock' }, [sheet, bar]);
    document.body.append(dock);
    document.body.classList.add('has-libchat');

    // ---------------------------------------------------------------------------

    function open() {
      sheet.hidden = false;
      dock.classList.add('open');
      showMode();
    }
    function minimize() {
      sheet.hidden = true;
      dock.classList.remove('open');
    }
    function fill(q, days) {
      open();
      if (days) range.value = String(days);
      const current = input.value.trim();
      input.value = current && !/\?$/.test(current) ? q.replace(/\[(topic|argument)\]/, current) : q;
      input.focus();
      const start = input.value.indexOf('[');
      if (start >= 0) input.setSelectionRange(start, input.value.indexOf(']', start) + 1);
      autosize();
    }
    function autosize() {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    }

    // The note open on the page can be the focus of the question.
    function showFocus() {
      const note = getFocus();
      focusChip.hidden = !note;
      if (!note) {
        focusOn = false;
        return;
      }
      focusChip.textContent = focusOn ? `About: ${(note.title || 'this note').slice(0, 40)} ×` : 'About this note';
      focusChip.setAttribute('aria-pressed', String(focusOn));
      focusChip.title = focusOn ? 'Ask about the whole library instead' : `Focus on “${note.title || 'this note'}”`;
    }
    focusChip.addEventListener('click', () => {
      focusOn = !focusOn;
      showFocus();
      input.focus();
    });

    async function showMode() {
      try {
        const st = await S.ext.runtime.sendMessage({ type: 'library:status' });
        mode.textContent = st.mode === 'meaning' ? `by meaning · ${st.indexed}/${st.total} notes` : `by words · ${st.total} notes`;
        mode.title = st.mode === 'meaning' ? `Searching by meaning and words with ${st.model}` : 'For search by meaning, install a free embedding model: ollama pull nomic-embed-text';
      } catch {
        mode.textContent = '';
      }
    }

    // The notes to use: most relevant in the time range (topped up with recent ones for broad
    // questions), with the focused note first.
    async function pickNotes(question) {
      const days = Number(range.value);
      const since = days ? Date.now() - days * 86400000 : 0;
      let hits = [];
      try {
        const res = await S.ext.runtime.sendMessage({ type: 'library:search', query: question, since, limit: MAX_NOTES });
        if (!res || res.ok === false) throw new Error('search failed');
        hits = res.results.map((r) => r.note);
      } catch {
        const all = (await S.listSnippets()).filter((n) => S.SEARCHABLE_KINDS.has(n.kind || 'page') && (!since || new Date(n.createdAt).getTime() >= since));
        hits = S.searchNotes(S.buildIndex(all), question, { limit: MAX_NOTES }).map((h) => h.note);
      }
      if (hits.length < 3) {
        const ids = new Set(hits.map((n) => n.id));
        const recent = (await S.listSnippets()).filter((n) => S.SEARCHABLE_KINDS.has(n.kind || 'page') && !ids.has(n.id) && (!since || new Date(n.createdAt).getTime() >= since));
        hits = [...hits, ...recent.slice(0, MAX_NOTES - hits.length)];
      }
      const focus = focusOn ? getFocus() : null;
      if (focus) hits = [focus, ...hits.filter((n) => n.id !== focus.id)].slice(0, MAX_NOTES);
      return hits;
    }

    function render(text, used, turn) {
      let html = S.renderMarkdown(S.stripThinking(text || ''));
      html = html.replace(/\[S(\d{1,2})\]/g, (m, n) => (used[Number(n) - 1] ? `<a class="cite" href="#lc-${turn}-${n}" title="${S.escapeHtml(used[Number(n) - 1].title || '')}">S${n}</a>` : m));
      return [...new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body.childNodes];
    }

    function sources(used, turn) {
      return el('details', { className: 'lc-sources' }, [
        el('summary', { textContent: `Sources: ${used.length} of your notes` }),
        el('ol', {}, used.map((n, i) => el('li', { id: `lc-${turn}-${i + 1}` }, [
          el('span', { className: 'n', textContent: `S${i + 1}` }),
          el('a', { href: `snippets.html#${encodeURIComponent(n.id)}`, textContent: n.title || n.pageTitle || 'Untitled' }),
          el('small', { textContent: [day(n.createdAt), hostOf(n.url)].filter(Boolean).join(' · ') }),
        ]))),
      ]);
    }

    function exportMarkdown(t) {
      const list = t.used.map((n, i) => `[S${i + 1}] ${n.title || 'Untitled'}${n.url ? ` — ${n.url}` : ''} (saved ${day(n.createdAt)})`).join('\n');
      return `# ${t.title}\n\n${S.stripThinking(t.text)}\n\n## Sources\n${list}\n`;
    }

    function answerActions(t) {
      const save = el('button', { type: 'button', className: 'lc-act', textContent: 'Save to snippets' });
      save.addEventListener('click', async () => {
        const snippet = await S.addSnippet({
          kind: 'deliverable',
          source: 'notes',
          title: t.title.slice(0, 160),
          summary: S.stripThinking(t.text).replace(/[*_#>`[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 220),
          text: `${S.stripThinking(t.text)}\n\n**Sources**\n${t.used.map((n, i) => `- [S${i + 1}] ${n.title || 'Untitled'}${n.url ? ` (${n.url})` : ''}`).join('\n')}`,
          tags: ['from-library'],
          sourceIds: t.used.map((n) => n.id),
        });
        save.textContent = 'Saved ✓';
        save.disabled = true;
        save.dataset.id = snippet.id;
      });
      const copy = el('button', { type: 'button', className: 'lc-act', textContent: 'Copy' });
      copy.addEventListener('click', async () => {
        await navigator.clipboard.writeText(exportMarkdown(t));
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy'), 1500);
      });
      const download = el('button', { type: 'button', className: 'lc-act', textContent: 'Download .md' });
      download.addEventListener('click', () => {
        const url = URL.createObjectURL(new Blob([exportMarkdown(t)], { type: 'text/markdown' }));
        el('a', { href: url, download: `${t.title.replace(/[^\w -]+/g, '').trim().slice(0, 60) || 'soroagent'}.md` }).click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
      return el('div', { className: 'lc-actions' }, [save, copy, download]);
    }

    async function run({ question, make }) {
      const topic = String(question || '').trim();
      open();
      if (!topic) {
        input.placeholder = make ? `What should the ${MAKE[make].label.toLowerCase()} be about? e.g. Choosing a vector database` : 'Type a question first.';
        input.focus();
        return;
      }
      if (running) running.abort();
      const followUp = !make && turns.length > 0;
      const used = await pickNotes(followUp ? `${turns[turns.length - 1].question}\n${topic}` : topic);
      if (!used.length) {
        log.append(el('div', { className: 'lc-empty', textContent: `No notes from ${range.selectedOptions[0].textContent.toLowerCase()} yet. Summarize a few pages (they're saved automatically), turn on passive capture in Settings, or choose a longer range.` }));
        return;
      }
      suggest.hidden = true;
      newChat.hidden = false;
      const turn = turns.length + log.childElementCount;
      const title = make ? `${MAKE[make].label}: ${topic}` : topic;
      const body = el('div', { className: 'lc-answer prose' });
      const status = el('div', { className: 'lc-working', textContent: `Reading ${used.length} of your notes…` });
      const stop = el('button', { type: 'button', className: 'lc-act', textContent: 'Stop' });
      const block = el('div', { className: 'lc-turn' }, [el('div', { className: 'lc-q', textContent: title }), status, body, sources(used, turn), el('div', { className: 'lc-actions' }, [stop])]);
      log.append(block);
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      input.value = '';
      autosize();
      input.placeholder = 'Ask a follow-up…';

      const days = range.selectedOptions[0].textContent.toLowerCase();
      const vars = { content: S.formatNotes(used), question: make ? `${MAKE[make].label} about: ${topic}` : topic, context: make ? MAKE[make].format : `The notes are from ${days}.${focusOn && getFocus() ? ' The question is mainly about note [S1].' : ''}` };
      const settings = await S.getSettings();
      const persona = S.customPersona(settings, 'default');
      const [system, user] = S.buildMessages(make ? 'deliverable' : 'synthesize', vars, persona ? { persona } : null);
      const history = turns.flatMap((t) => [{ role: 'user', content: t.question }, { role: 'assistant', content: t.answer }]);
      const controller = new AbortController();
      running = controller;
      stop.addEventListener('click', () => controller.abort());
      let text = '';
      let frame = 0;
      try {
        const reply = await S.askModel([system, ...history, user], {
          signal: controller.signal,
          onToken: (tok) => {
            text += tok;
            status.textContent = 'Writing…';
            if (!frame) frame = requestAnimationFrame(() => ((frame = 0), body.replaceChildren(...render(text, used, turn))));
          },
        });
        text = reply || text;
        status.remove();
        body.replaceChildren(...render(text, used, turn));
        const t = { title, text, used };
        turns.push({ question: topic, answer: S.stripThinking(text) });
        stop.parentElement.replaceWith(answerActions(t));
      } catch (err) {
        status.className = err.name === 'AbortError' ? 'lc-working done' : 'lc-problem';
        status.textContent = err.name === 'AbortError' ? 'Stopped.' : `${err.message}${err.hint ? ` ${err.hint}` : ''}`;
        stop.remove();
      } finally {
        if (running === controller) running = null;
      }
    }

    // ---------------------------------------------------------------------------

    send.addEventListener('click', () => run({ question: input.value }));
    input.addEventListener('focus', open);
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        run({ question: input.value });
      } else if (e.key === 'Escape') {
        minimize();
        input.blur();
      }
    });
    close.addEventListener('click', minimize);
    newChat.addEventListener('click', () => {
      if (running) running.abort();
      turns = [];
      log.replaceChildren();
      suggest.hidden = false;
      newChat.hidden = true;
      input.placeholder = placeholder;
      input.focus();
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
        input.focus();
      } else if (e.key === 'Escape' && dock.classList.contains('open') && !dock.contains(document.activeElement)) minimize();
    });
    // The page tells the console when the open note changes.
    const refresh = () => showFocus();
    refresh();

    // ?ask=<topic> (from the panel) opens the console on that topic.
    const topic = new URLSearchParams(location.search).get('ask');
    if (topic) {
      open();
      input.value = `What have I learned about ${topic.slice(0, 120)}?`;
      autosize();
      history.replaceState(null, '', location.pathname + location.hash);
    }

    return { open, refresh, ask: (q) => run({ question: q }) };
  }

  S.mountLibraryChat = mountLibraryChat;
})(globalThis);
