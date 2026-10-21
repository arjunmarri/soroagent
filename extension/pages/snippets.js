(function () {
  'use strict';

  const S = globalThis.SoroAgent;
  const { ext, listSnippets, deleteSnippets, importSnippets, isSnippetChange, groupTimeline, renderMarkdown, stripThinking } = S;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };
  // Model output is escaped by renderMarkdown; DOMParser keeps it inert.
  const markdown = (text) => [...new DOMParser().parseFromString(`<body>${renderMarkdown(stripThinking(text || ''))}</body>`, 'text/html').body.childNodes];

  const PREFS_KEY = 'soroagent.snippetsView';
  let snippets = [];
  let selectedId = '';
  let tagFilter = '';
  let siteFilter = '';
  let prefs = { group: 'day', kind: 'all' };
  try {
    prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    // keep defaults
  }
  const savePrefs = () => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // not saved; still applied
    }
  };
  const research = new Map(); // snippet id -> { status, text, error, sources } while running

  const KIND_LABEL = { summary: 'Summary', selection: 'Selection', page: 'Page', research: 'Research' };
  const kindOf = (s) => s.kind || (s.source === 'selection' ? 'selection' : s.source === 'summary' ? 'summary' : 'page');
  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const siteColor = (host) => {
    let hash = 0;
    for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 45% 45%)`;
  };
  const when = (iso, opts) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, opts);
  };
  const plain = (text) => stripThinking(text || '').replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').trim();

  function matches(s, query) {
    const kind = kindOf(s);
    if (prefs.kind === 'summary' && kind !== 'summary') return false;
    if (prefs.kind === 'selection' && kind !== 'selection' && kind !== 'page') return false;
    if (prefs.kind === 'research' && !s.research && kind !== 'research') return false;
    if (tagFilter && !s.tags.includes(tagFilter)) return false;
    if (siteFilter && hostOf(s.url) !== siteFilter) return false;
    if (!query) return true;
    const haystack = [s.title, s.summary, s.text, s.pageTitle, s.url, ...s.tags, s.research && s.research.text].join(' ').toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  }

  // ---------------------------------------------------------------------------
  // List
  // ---------------------------------------------------------------------------

  function siteBadge(host) {
    return el('span', { className: 'site' }, [
      el('span', { className: 'avatar', textContent: (host[0] || '?').toUpperCase(), style: `background:${siteColor(host || '?')}` }),
      el('span', { textContent: host }),
    ]);
  }

  function renderCard(s) {
    const kind = kindOf(s);
    const host = hostOf(s.url);
    const summary = s.summary || plain(s.text).slice(0, 220);
    const card = el('button', { type: 'button', className: 'card' }, [
      el('div', { className: 'card-title', textContent: s.title || s.pageTitle || 'Untitled' }),
      summary ? el('div', { className: 'card-summary', textContent: summary }) : '',
      el('div', { className: 'meta' }, [
        el('span', { className: `kind ${kind}`, textContent: KIND_LABEL[kind] || kind }),
        host ? siteBadge(host) : '',
        el('span', { textContent: when(s.createdAt, { hour: 'numeric', minute: '2-digit', ...(prefs.group === 'day' ? {} : { day: 'numeric', month: 'short' }) }) }),
        s.research ? el('span', { className: 'has-research', textContent: '· researched' }) : '',
      ]),
    ]);
    card.setAttribute('aria-current', String(s.id === selectedId));
    card.addEventListener('click', () => select(s.id));
    return card;
  }

  function groups(visible) {
    if (prefs.group === 'site') {
      const bySite = new Map();
      for (const s of visible) {
        const host = hostOf(s.url) || 'Other';
        if (!bySite.has(host)) bySite.set(host, []);
        bySite.get(host).push(s);
      }
      return [...bySite.entries()].sort((a, b) => String(b[1][0].createdAt).localeCompare(String(a[1][0].createdAt))).map(([label, items]) => ({ label, items }));
    }
    if (prefs.group === 'topic') {
      const byTag = new Map();
      for (const s of visible) {
        const tag = s.tags[0] ? `#${s.tags[0]}` : 'No topic';
        if (!byTag.has(tag)) byTag.set(tag, []);
        byTag.get(tag).push(s);
      }
      return [...byTag.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([label, items]) => ({ label, items }));
    }
    return groupTimeline(visible).flatMap((month) => month.days.map((day) => ({ label: day.label, items: day.items })));
  }

  function renderList(visible) {
    if (!visible.length) {
      $('list').replaceChildren(el('div', {
        className: 'empty',
        textContent: snippets.length ? 'No snippets match.' : 'No snippets yet. Every summary you make is saved here automatically.',
      }));
      return;
    }
    const nodes = [];
    for (const group of groups(visible)) {
      nodes.push(el('div', { className: 'group-head' }, [el('span', { textContent: group.label }), el('small', { textContent: String(group.items.length) })]));
      for (const s of group.items) nodes.push(renderCard(s));
    }
    $('list').replaceChildren(...nodes);
  }

  // ---------------------------------------------------------------------------
  // Reading view
  // ---------------------------------------------------------------------------

  function sourcesList(sources) {
    return el('ol', { className: 'sources' }, (sources || []).map((src) =>
      el('li', {}, [el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', textContent: src.title || hostOf(src.url) }), el('small', { textContent: ` ${hostOf(src.url)}` })])
    ));
  }

  function renderReader() {
    const reader = $('reader');
    const s = snippets.find((x) => x.id === selectedId);
    reader.classList.toggle('open', Boolean(s));
    if (!s) {
      reader.replaceChildren(el('div', { className: 'reader-empty', textContent: snippets.length ? 'Select a snippet to read it here.' : 'Your snippets will appear here.' }));
      return;
    }
    const kind = kindOf(s);
    const host = hostOf(s.url);
    const back = el('button', { type: 'button', className: 'btn small back', textContent: '← All snippets' });
    back.addEventListener('click', () => select(''));

    const meta = el('div', { className: 'meta' }, [
      el('span', { className: `kind ${kind}`, textContent: KIND_LABEL[kind] || kind }),
      host ? siteBadge(host) : '',
      el('span', { textContent: when(s.createdAt, { dateStyle: 'medium', timeStyle: 'short' }) }),
      s.model ? el('span', { textContent: s.model }) : '',
    ]);
    const nodes = [back, meta, el('h1', { textContent: s.title || s.pageTitle || 'Untitled' })];
    if (s.tags.length) {
      nodes.push(el('div', { className: 'tags' }, s.tags.map((tag) => {
        const chip = el('button', { type: 'button', className: 'tag', textContent: `#${tag}` });
        chip.addEventListener('click', () => {
          tagFilter = tag;
          render();
        });
        return chip;
      })));
    }

    const body = el('div', { className: 'prose' });
    if (kind === 'summary' || kind === 'research') body.append(...markdown(s.text));
    else {
      if (s.summary) body.append(el('p', { textContent: s.summary }));
      body.append(el('blockquote', { className: 'quote', textContent: s.text }));
    }
    nodes.push(body);

    // Research: further reading from the web, attached to this snippet.
    nodes.push(el('div', { className: 'section-title', textContent: 'Research' }));
    const live = research.get(s.id);
    if (live && live.status === 'running') {
      nodes.push(el('div', { className: 'working', textContent: live.statusText || 'Researching on the web…' }));
      if (live.sources) nodes.push(sourcesList(live.sources));
      if (live.text) nodes.push(el('div', { className: 'prose' }, markdown(live.text)));
    } else if (s.research && kind !== 'research') {
      nodes.push(el('div', { className: 'meta', textContent: `Searched “${s.research.query || ''}” · ${when(s.research.at, { dateStyle: 'medium', timeStyle: 'short' })}` }));
      nodes.push(el('div', { className: 'prose' }, markdown(s.research.text)));
      nodes.push(el('div', { className: 'section-title', textContent: 'Sources' }), sourcesList(s.research.sources));
    } else if (kind === 'research' && s.research) {
      nodes.push(sourcesList(s.research.sources));
    } else {
      nodes.push(el('p', { className: 'muted', textContent: 'Look this topic up on the web: SoroAgent searches, reads the top sources and writes a cited brief that goes beyond this snippet.' }));
    }
    if (live && live.status === 'error') nodes.push(el('div', { className: 'problem', textContent: live.error }));

    const actions = el('div', { className: 'reader-actions' });
    if (kind !== 'research' && !(live && live.status === 'running')) {
      const go = el('button', { type: 'button', className: 'btn primary', textContent: s.research ? 'Research again' : 'Research this further' });
      go.addEventListener('click', () => startResearch(s));
      actions.append(go);
    }
    if (/^https?:/.test(s.url)) actions.append(el('a', { className: 'btn', href: s.url, target: '_blank', rel: 'noopener', textContent: 'Open source ↗' }));
    const copy = el('button', { type: 'button', className: 'btn', textContent: 'Copy' });
    copy.addEventListener('click', async () => {
      const extra = s.research ? `\n\n## Research\n${stripThinking(s.research.text)}` : '';
      await navigator.clipboard.writeText(`# ${s.title}\n${s.url}\n\n${stripThinking(s.text)}${extra}`);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    });
    const remove = el('button', { type: 'button', className: 'btn danger', textContent: 'Delete' });
    remove.addEventListener('click', async () => {
      await deleteSnippets([s.id]);
      selectedId = '';
    });
    actions.append(copy, remove);
    nodes.push(actions);
    reader.replaceChildren(...nodes);
  }

  // Research runs as a background job, so it finishes even if this page is closed; the
  // result is attached to the snippet.
  function startResearch(s) {
    const job = { status: 'running', statusText: 'Choosing what to search for…', text: '', sources: null };
    research.set(s.id, job);
    renderReader();
    const vars = S.pageVars({ title: s.pageTitle || s.title, url: s.url, text: stripThinking(s.text).slice(0, 4000) });
    const port = ext.runtime.connect({ name: 'summary' });
    let frame = 0;
    const refresh = () => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), s.id === selectedId && renderReader()));
    };
    port.onMessage.addListener((msg) => {
      if (msg.type === 'status') job.statusText = msg.text;
      else if (msg.type === 'sources') job.sources = msg.sources;
      else if (msg.type === 'token') job.text += msg.text;
      else if (msg.type === 'done') {
        research.delete(s.id);
        port.disconnect();
      } else if (msg.type === 'error') {
        Object.assign(job, { status: 'error', error: `${(msg.record && msg.record.error) || 'Research failed.'} ${(msg.record && msg.record.hint) || ''}` });
        port.disconnect();
      }
      refresh();
    });
    port.postMessage({
      type: 'start',
      job: {
        kind: 'research',
        label: `Research: ${s.title}`,
        url: s.url,
        pageTitle: s.pageTitle || s.title,
        site: hostOf(s.url),
        snippetId: s.id,
        fallbackQuery: s.title,
        queryMessages: S.buildMessages('researchQuery', vars),
        final: S.buildMessages('research', S.pageVars(
          { title: s.title, url: s.url, text: S.JOB_PLACEHOLDERS.sources },
          { context: stripThinking(s.text).slice(0, 3000), question: S.JOB_PLACEHOLDERS.query }
        )),
      },
    });
  }

  function select(id) {
    selectedId = id;
    render();
    if (id && window.innerWidth > 860) $('reader').scrollTop = 0;
  }

  // ---------------------------------------------------------------------------

  function renderFilters() {
    const box = $('filters');
    box.replaceChildren();
    const add = (label, value, clear) => {
      const button = el('button', { className: 'btn small', type: 'button', textContent: 'Clear' });
      button.addEventListener('click', () => {
        clear();
        render();
      });
      box.append(el('span', { textContent: label }), el('span', { className: 'tag', textContent: value }), button);
    };
    if (tagFilter) add('Topic:', `#${tagFilter}`, () => (tagFilter = ''));
    if (siteFilter) add('Site:', siteFilter, () => (siteFilter = ''));
    box.hidden = !tagFilter && !siteFilter;
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const visible = snippets.filter((s) => matches(s, query));
    $('count').textContent = snippets.length ? `(${snippets.length})` : '';
    for (const b of document.querySelectorAll('[data-group]')) b.setAttribute('aria-pressed', String(b.dataset.group === prefs.group));
    for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === prefs.kind));
    renderFilters();
    renderList(visible);
    renderReader();
  }

  async function load() {
    snippets = (await listSnippets()).map((s) => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] }));
    if (!selectedId && snippets.length && window.innerWidth > 860) selectedId = snippets[0].id;
    if (selectedId && !snippets.some((s) => s.id === selectedId)) selectedId = '';
    render();
  }

  function download(name, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    el('a', { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);

  for (const b of document.querySelectorAll('[data-group]')) {
    b.addEventListener('click', () => {
      prefs.group = b.dataset.group;
      savePrefs();
      render();
    });
  }
  for (const b of document.querySelectorAll('[data-kind]')) {
    b.addEventListener('click', () => {
      prefs.kind = b.dataset.kind;
      savePrefs();
      render();
    });
  }
  $('search').addEventListener('input', render);

  $('exportJson').addEventListener('click', () => download(`soroagent-snippets-${stamp()}.json`, 'application/json', JSON.stringify(snippets, null, 2)));
  $('exportMd').addEventListener('click', () => {
    const md = snippets
      .map((s) => {
        const tags = s.tags.length ? `\n${s.tags.map((t) => `#${t}`).join(' ')}` : '';
        const body = kindOf(s) === 'summary' || kindOf(s) === 'research' ? stripThinking(s.text) : s.text.split('\n').map((l) => `> ${l}`).join('\n');
        const extra = s.research && kindOf(s) !== 'research' ? `\n\n### Research\n${stripThinking(s.research.text)}\n\n${(s.research.sources || []).map((src, i) => `${i + 1}. [${src.title}](${src.url})`).join('\n')}` : '';
        return `## ${s.title}\n\n${s.url}  \n_${when(s.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}_${tags}\n\n${body}${extra}\n`;
      })
      .join('\n---\n\n');
    download(`soroagent-snippets-${stamp()}.md`, 'text/markdown', `# SoroAgent snippets\n\n${md}`);
  });
  $('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const items = JSON.parse(await file.text());
      const added = await importSnippets(Array.isArray(items) ? items : []);
      alert(`Imported ${added} snippet${added === 1 ? '' : 's'}.`);
    } catch (err) {
      alert(`Couldn't import that file: ${err.message}`);
    }
  });
  $('clear').addEventListener('click', async () => {
    if (snippets.length && confirm(`Delete all ${snippets.length} snippets? Download a backup first if you want to keep them.`)) {
      await deleteSnippets(snippets.map((s) => s.id));
    }
  });

  let pending = 0;
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !isSnippetChange(changes)) return;
    clearTimeout(pending);
    pending = setTimeout(load, 200);
  });

  load();
})();
