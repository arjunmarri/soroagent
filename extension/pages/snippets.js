(function () {
  'use strict';

  const S = globalThis.soroagent;
  const { ext, listSnippets, deleteSnippets, importSnippets, isSnippetChange, groupTimeline, renderMarkdown, stripThinking } = S;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };
  // Model output is escaped by renderMarkdown; DOMParser keeps it inert.
  // `url` links @handles (X) and u/ r/ names (Reddit) in summaries of those sites.
  const markdown = (text, url) => [...new DOMParser().parseFromString(`<body>${renderMarkdown(S.linkHandles(stripThinking(text || ''), url))}</body>`, 'text/html').body.childNodes];

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
  let settings = {};
  // The prompts for the site a snippet came from, with the system prompt from settings if any.
  const promptsForUrl = (url) => {
    const id = S.promptSetForHost(hostOf(url));
    const persona = S.customPersona(settings, id);
    return S.promptsFor(id, persona ? { persona } : null);
  };
  const research = new Map(); // snippet id -> { status, text, error, sources } while running

  const KIND_LABEL = { summary: 'Summary', selection: 'Selection', page: 'Page', research: 'Research', screenshot: 'Screenshot', readlater: 'Read later', wishlist: 'Wish list' };
  // Kinds with a section of their own, kept out of the text views.
  const SECTIONS = ['screenshot', 'readlater', 'wishlist'];
  const topicPicks = new Map(); // snippet id -> { status: 'loading' | 'ready' | 'error', topics, error, draft }
  if (!['all', 'summary', 'research', ...SECTIONS].includes(prefs.kind)) prefs.kind = 'all'; // e.g. the old Selections view
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
    // Screenshots and Read later have their own sections and stay out of the text views.
    if (SECTIONS.includes(prefs.kind) || SECTIONS.includes(kind)) {
      if (prefs.kind !== kind) return false;
    }
    if (prefs.kind === 'summary' && kind !== 'summary') return false;
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
    const thumb = kind === 'wishlist' && s.image ? el('img', { className: 'thumb', src: s.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' }) : '';
    if (thumb) thumb.addEventListener('error', () => thumb.remove());
    const card = el('button', { type: 'button', className: `card${s.readAt || s.boughtAt ? ' read' : ''}${thumb ? ' with-thumb' : ''}` }, [
      thumb,
      el('div', { className: 'card-title', textContent: s.title || s.pageTitle || 'Untitled' }),
      summary ? el('div', { className: 'card-summary', textContent: summary }) : '',
      el('div', { className: 'meta' }, [
        el('span', { className: `kind ${kind}`, textContent: KIND_LABEL[kind] || kind }),
        host ? siteBadge(host) : '',
        el('span', { textContent: when(s.createdAt, { hour: 'numeric', minute: '2-digit', ...(prefs.group === 'day' ? {} : { day: 'numeric', month: 'short' }) }) }),
        s.research ? el('span', { className: 'has-research', textContent: '· researched' }) : '',
        s.readAt ? el('span', { className: 'is-read', textContent: '· read' }) : '',
        s.boughtAt ? el('span', { className: 'is-read', textContent: '· bought' }) : '',
      ]),
    ]);
    card.setAttribute('aria-current', String(s.id === selectedId));
    card.addEventListener('click', () => select(s.id));
    return card;
  }

  function renderShot(s) {
    const host = hostOf(s.url);
    const shot = el('button', { type: 'button', className: 'shot' }, [
      el('img', { src: s.image, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', { className: 'card-title', textContent: s.title || s.pageTitle || 'Screenshot' }),
      el('div', { className: 'meta' }, [host ? siteBadge(host) : '', el('span', { textContent: when(s.createdAt, { hour: 'numeric', minute: '2-digit' }) })]),
    ]);
    shot.setAttribute('aria-current', String(s.id === selectedId));
    shot.addEventListener('click', () => select(s.id));
    return shot;
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
        textContent: prefs.kind === 'screenshot'
          ? 'No screenshots yet. Use Screenshot in the soroagent panel (or right-click a page) to take one.'
          : prefs.kind === 'wishlist'
          ? 'Your wish list is empty. On a product page, click Buy later in the soroagent panel to save it here.'
          : prefs.kind === 'readlater'
          ? 'Nothing to read later. Click Read later in the soroagent panel to keep a page for later.'
          : snippets.some((s) => !SECTIONS.includes(kindOf(s))) ? 'No snippets match.' : 'No snippets yet. Every summary you make is saved here automatically.',
      }));
      $('list').classList.remove('gallery');
      return;
    }
    $('list').classList.toggle('gallery', prefs.kind === 'screenshot');
    const nodes = [];
    for (const group of groups(visible)) {
      nodes.push(el('div', { className: 'group-head' }, [el('span', { textContent: group.label }), el('small', { textContent: String(group.items.length) })]));
      for (const s of group.items) nodes.push(kindOf(s) === 'screenshot' ? renderShot(s) : renderCard(s));
    }
    $('list').replaceChildren(...nodes);
  }

  // ---------------------------------------------------------------------------
  // Reading view
  // ---------------------------------------------------------------------------

  function sourcesList(sources) {
    return el('ol', { className: 'sources' }, (sources || []).map((src) =>
      el('li', {}, [el('a', { href: S.safeUrl(src.url), target: '_blank', rel: 'noopener noreferrer', textContent: src.title || hostOf(src.url) }), el('small', { textContent: ` ${hostOf(src.url)}` })])
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

    if (kind === 'screenshot') {
      renderShotReader(s, reader, [back, meta, el('h1', { textContent: s.title || s.pageTitle || 'Screenshot' })]);
      return;
    }
    if (kind === 'wishlist') {
      renderWishReader(s, reader, [back, meta, el('h1', { textContent: s.title || s.pageTitle || 'Product' })]);
      return;
    }
    if (kind === 'readlater') {
      renderLaterReader(s, reader, [back, meta, el('h1', { textContent: s.title || s.pageTitle || 'Untitled' })]);
      return;
    }

    const body = el('div', { className: 'prose' });
    if (kind === 'summary' || kind === 'research') body.append(...markdown(s.text, s.url));
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
      if (live.text) nodes.push(el('div', { className: 'prose' }, markdown(live.text, s.url)));
    } else if (s.research && kind !== 'research') {
      nodes.push(el('div', { className: 'meta', textContent: `Searched “${s.research.query || ''}” · ${when(s.research.at, { dateStyle: 'medium', timeStyle: 'short' })}` }));
      nodes.push(el('div', { className: 'prose' }, markdown(s.research.text, s.url)));
      nodes.push(el('div', { className: 'section-title', textContent: 'Sources' }), sourcesList(s.research.sources));
    } else if (kind === 'research' && s.research) {
      nodes.push(sourcesList(s.research.sources));
    } else if (!topicPicks.has(s.id)) {
      nodes.push(el('p', { className: 'muted', textContent: 'Look this topic up on the web: soroagent searches, reads the top sources and writes a cited brief that goes beyond this snippet.' }));
    }
    if (topicPicks.has(s.id) && !(live && live.status === 'running')) nodes.push(...topicPicker(s));
    if (live && live.status === 'error') nodes.push(el('div', { className: 'problem', textContent: live.error }));

    const actions = el('div', { className: 'reader-actions' });
    if (kind !== 'research' && !(live && live.status === 'running') && !topicPicks.has(s.id)) {
      const go = el('button', { type: 'button', className: 'btn primary', textContent: s.research ? 'Research again' : 'Research this further' });
      go.addEventListener('click', () => pickTopic(s));
      actions.append(go);
    }
    if (/^https?:/.test(s.url)) actions.append(el('a', { className: 'btn', href: S.safeUrl(s.url), target: '_blank', rel: 'noopener', textContent: 'Open source ↗' }));
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

  function shotFileName(s) {
    const name = (hostOf(s.url) || 'screenshot').replace(/[^a-z0-9.-]+/gi, '-');
    return `soroagent-${name}-${String(s.createdAt).slice(0, 19).replace(/[T:]/g, '-')}.jpg`;
  }

  function renderShotReader(s, reader, nodes) {
    const img = el('img', { className: 'shot-full', src: s.image, alt: `Screenshot of ${s.pageTitle || s.url}` });
    // Full size in a new tab (browsers block opening data: URLs directly).
    img.addEventListener('click', async () => window.open(URL.createObjectURL(await (await fetch(s.image)).blob()), '_blank'));
    nodes.push(img);
    const actions = el('div', { className: 'reader-actions' });
    const save = el('a', { className: 'btn primary', href: s.image, download: shotFileName(s), textContent: 'Download' });
    const copy = el('button', { type: 'button', className: 'btn', textContent: 'Copy image' });
    copy.addEventListener('click', async () => {
      try {
        // The clipboard takes PNG, so redraw the stored JPEG.
        const bitmap = await createImageBitmap(await (await fetch(s.image)).blob());
        const canvas = el('canvas', { width: bitmap.width, height: bitmap.height });
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
        copy.textContent = 'Copied';
      } catch {
        copy.textContent = 'Copy not supported here';
      }
      setTimeout(() => (copy.textContent = 'Copy image'), 1500);
    });
    actions.append(save, copy);
    if (/^https?:/.test(s.url)) actions.append(el('a', { className: 'btn', href: S.safeUrl(s.url), target: '_blank', rel: 'noopener', textContent: 'Open page ↗' }));
    const remove = el('button', { type: 'button', className: 'btn danger', textContent: 'Delete' });
    remove.addEventListener('click', async () => {
      await deleteSnippets([s.id]);
      selectedId = '';
    });
    actions.append(remove);
    nodes.push(actions);
    reader.replaceChildren(...nodes);
  }

  function renderWishReader(s, reader, nodes) {
    const details = el('div', {}, [
      s.price ? el('p', { className: 'big-price', textContent: s.price }) : el('p', { className: 'muted', textContent: 'No price was shown on the page.' }),
      el('p', { className: 'muted', textContent: s.boughtAt ? `Marked as bought ${when(s.boughtAt, { dateStyle: 'medium' })}.` : `Saved to buy later, ${when(s.createdAt, { dateStyle: 'medium' })}. Prices change; check the page before buying.` }),
    ]);
    const image = s.image ? el('img', { src: s.image, alt: s.title || '', referrerPolicy: 'no-referrer' }) : '';
    if (image) image.addEventListener('error', () => image.remove());
    nodes.push(image ? el('div', { className: 'product' }, [image, details]) : details);
    const actions = el('div', { className: 'reader-actions' });
    const buy = el('a', { className: 'btn primary', href: S.safeUrl(s.url), target: '_blank', rel: 'noopener', textContent: 'View product ↗' });
    const bought = el('button', { type: 'button', className: 'btn', textContent: s.boughtAt ? 'Not bought yet' : 'Mark as bought' });
    bought.addEventListener('click', () => S.updateSnippet(s.id, { boughtAt: s.boughtAt ? '' : new Date().toISOString() }));
    const remove = el('button', { type: 'button', className: 'btn danger', textContent: 'Remove' });
    remove.addEventListener('click', async () => {
      await deleteSnippets([s.id]);
      selectedId = '';
    });
    actions.append(buy, bought, remove);
    nodes.push(actions);
    reader.replaceChildren(...nodes);
  }

  function renderLaterReader(s, reader, nodes) {
    if (s.summary) nodes.push(el('div', { className: 'prose' }, [el('p', { textContent: s.summary })]));
    nodes.push(el('p', { className: 'muted', textContent: s.readAt ? `Marked as read ${when(s.readAt, { dateStyle: 'medium', timeStyle: 'short' })}.` : 'Saved to read later.' }));
    const actions = el('div', { className: 'reader-actions' });
    const open = el('a', { className: 'btn primary', href: S.safeUrl(s.url), target: '_blank', rel: 'noopener', textContent: 'Open page ↗' });
    open.addEventListener('click', () => !s.readAt && S.updateSnippet(s.id, { readAt: new Date().toISOString() }));
    const mark = el('button', { type: 'button', className: 'btn', textContent: s.readAt ? 'Mark as unread' : 'Mark as read' });
    mark.addEventListener('click', () => S.updateSnippet(s.id, { readAt: s.readAt ? '' : new Date().toISOString() }));
    const remove = el('button', { type: 'button', className: 'btn danger', textContent: 'Remove' });
    remove.addEventListener('click', async () => {
      await deleteSnippets([s.id]);
      selectedId = '';
    });
    actions.append(open, mark, remove);
    nodes.push(actions);
    reader.replaceChildren(...nodes);
  }

  // Before researching, ask what to focus on: topics the model finds in the snippet, the whole
  // snippet, or the reader's own words.
  function pickTopic(s) {
    const pick = { status: 'loading', topics: [], error: '', draft: '' };
    topicPicks.set(s.id, pick);
    renderReader();
    const vars = S.pageVars({ title: s.pageTitle || s.title, url: s.url, text: stripThinking(s.text || s.summary || '').slice(0, 4000) });
    S.askModel(S.buildMessages('researchTopics', vars, promptsForUrl(s.url)), { json: true })
      .then((reply) => Object.assign(pick, { status: 'ready', topics: S.parseTopics(stripThinking(reply)) }))
      .catch((err) => Object.assign(pick, { status: 'error', error: err.message }))
      .finally(() => s.id === selectedId && renderReader());
  }

  function topicPicker(s) {
    const pick = topicPicks.get(s.id);
    const start = (query) => {
      topicPicks.delete(s.id);
      startResearch(s, query);
    };
    const heading = el('p', {
      textContent: pick.status === 'loading' ? 'Finding topics in this snippet…'
        : pick.status === 'error' ? `Couldn't suggest topics (${pick.error}). Research everything, or type your own:`
        : pick.topics.length ? 'What should the research focus on? Pick a topic, or research everything:' : 'No clear topics found. Research everything, or type your own:',
      className: pick.status === 'loading' ? 'working' : '',
    });
    const topics = el('div', { className: 'topics' });
    for (const topic of pick.topics) {
      const button = el('button', { type: 'button', className: 'topic', textContent: topic });
      button.addEventListener('click', () => start(topic));
      topics.append(button);
    }
    const everything = el('button', { type: 'button', className: 'topic all', textContent: 'Everything in this snippet' });
    everything.addEventListener('click', () => start(''));
    topics.append(everything);
    const input = el('input', { type: 'text', placeholder: 'Or type your own topic…', value: pick.draft, maxLength: 120 });
    input.setAttribute('aria-label', 'Research topic');
    input.addEventListener('input', () => (pick.draft = input.value));
    const go = el('button', { type: 'button', className: 'btn primary small', textContent: 'Research' });
    go.addEventListener('click', () => input.value.trim() && start(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing && input.value.trim()) start(input.value.trim());
    });
    const cancel = el('button', { type: 'button', className: 'btn small', textContent: 'Cancel' });
    cancel.addEventListener('click', () => {
      topicPicks.delete(s.id);
      renderReader();
    });
    return [heading, topics, el('div', { className: 'topic-own' }, [input, go, cancel])];
  }

  // Research runs as a background job, so it finishes even if this page is closed; the
  // result is attached to the snippet.
  function startResearch(s, query = '') {
    const job = { status: 'running', statusText: query ? `Searching the web for “${query}”…` : 'Choosing what to search for…', text: '', sources: null };
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
        query,
        queryMessages: query ? null : S.buildMessages('researchQuery', vars, promptsForUrl(s.url)),
        final: S.buildMessages('research', S.pageVars(
          { title: s.title, url: s.url, text: S.JOB_PLACEHOLDERS.sources },
          { context: stripThinking(s.text).slice(0, 3000), question: S.JOB_PLACEHOLDERS.query }
        ), promptsForUrl(s.url)),
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
    const shots = snippets.filter((s) => kindOf(s) === 'screenshot').length;
    const later = snippets.filter((s) => kindOf(s) === 'readlater' && !s.readAt).length;
    $('count').textContent = snippets.length ? `(${snippets.length})` : '';
    $('shotCount').textContent = shots ? `(${shots})` : '';
    $('laterCount').textContent = later ? `(${later})` : '';
    const wishes = snippets.filter((s) => kindOf(s) === 'wishlist' && !s.boughtAt).length;
    $('wishCount').textContent = wishes ? `(${wishes})` : '';
    for (const b of document.querySelectorAll('[data-group]')) b.setAttribute('aria-pressed', String(b.dataset.group === prefs.group));
    for (const b of document.querySelectorAll('[data-kind]')) b.setAttribute('aria-pressed', String(b.dataset.kind === prefs.kind));
    renderFilters();
    renderList(visible);
    renderReader();
  }

  // snippets.html#<id> opens that snippet (the panel links new screenshots this way).
  function openFromHash() {
    const view = location.hash.match(/^#view=(\w+)$/);
    if (view && SECTIONS.includes(view[1])) {
      prefs.kind = view[1];
      selectedId = '';
      history.replaceState(null, '', location.pathname);
      return;
    }
    const id = decodeURIComponent(location.hash.slice(1));
    const s = id && snippets.find((x) => x.id === id);
    if (!s) return;
    selectedId = id;
    prefs.kind = SECTIONS.includes(kindOf(s)) ? kindOf(s) : 'all';
    history.replaceState(null, '', location.pathname);
  }

  async function load() {
    settings = await S.getSettings();
    snippets = (await listSnippets()).map((s) => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] }));
    openFromHash();
    if (!selectedId && window.innerWidth > 860) selectedId = (snippets.find((s) => matches(s, '')) || { id: '' }).id;
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
      const first = snippets.find((s) => matches(s, ''));
      if (window.innerWidth > 860) selectedId = first ? first.id : '';
      render();
    });
  }
  $('search').addEventListener('input', render);

  window.addEventListener('hashchange', () => {
    openFromHash();
    render();
  });

  $('exportJson').addEventListener('click', () => download(`soroagent-snippets-${stamp()}.json`, 'application/json', JSON.stringify(snippets, null, 2)));
  $('exportMd').addEventListener('click', () => {
    const md = snippets
      .filter((s) => !SECTIONS.includes(kindOf(s)))
      .map((s) => {
        const tags = s.tags.length ? `\n${s.tags.map((t) => `#${t}`).join(' ')}` : '';
        const body = kindOf(s) === 'summary' || kindOf(s) === 'research' ? stripThinking(s.text) : s.text.split('\n').map((l) => `> ${l}`).join('\n');
        const extra = s.research && kindOf(s) !== 'research' ? `\n\n### Research\n${stripThinking(s.research.text)}\n\n${(s.research.sources || []).map((src, i) => `${i + 1}. [${src.title}](${src.url})`).join('\n')}` : '';
        return `## ${s.title}\n\n${s.url}  \n_${when(s.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}_${tags}\n\n${body}${extra}\n`;
      })
      .join('\n---\n\n');
    download(`soroagent-snippets-${stamp()}.md`, 'text/markdown', `# soroagent snippets\n\n${md}`);
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
