// The on-page assistant: a floating owl button that opens a panel connected to the model.
// Loaded last; depends on shared/*.js, sites/*.js, content/extract.js, styles.js and launcher.js.
(function () {
  'use strict';

  if (!(document.documentElement instanceof HTMLElement) || !document.body) return; // XML, SVG, PDF viewers

  const S = globalThis.SoroAgent;
  const { ext } = S;

  // ---------------------------------------------------------------------------
  // Icons
  // ---------------------------------------------------------------------------

  const svg = (body, fill = 'none') =>
    `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  // The SoroAgent owl: a monochrome outline — always there, quietly watching.
  const OWL =
    '<svg class="owl" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M5.5 3.5 6.2 8.2Q4.8 10.5 5.2 13.5Q6 19.5 12 20.5Q18 19.5 18.8 13.5Q19.2 10.5 17.8 8.2L18.5 3.5 15 6.2Q12 5.2 9 6.2Z"/>' +
    '<g class="eyes"><circle cx="9.2" cy="10.6" r="2.3"/><circle cx="14.8" cy="10.6" r="2.3"/>' +
    '<g class="pupils" fill="currentColor" stroke="none"><circle cx="9.2" cy="10.6" r="0.95"/><circle cx="14.8" cy="10.6" r="0.95"/></g></g>' +
    '<path d="M11.2 13.2 12 14.6 12.8 13.2"/><path class="wings" d="M7.6 13.6q.7 3 3.4 4.6M16.4 13.6q-.7 3-3.4 4.6"/>' +
    // Spread wings, shown while the owl is carried or flying.
    '<path class="wing wing-l" d="M5.6 11.6Q1.6 11.2 0.4 6.6Q2.4 8.8 3.6 8.9Q2.6 7.6 2.8 6.6Q4.6 9.6 6.1 9.4"/>' +
    '<path class="wing wing-r" d="M18.4 11.6Q22.4 11.2 23.6 6.6Q21.6 8.8 20.4 8.9Q21.4 7.6 21.2 6.6Q19.4 9.6 17.9 9.4"/></svg>';
  const ICONS = {
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    summarize: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    save: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    stop: svg('<rect x="7" y="7" width="10" height="10" rx="1.5"/>', 'currentColor'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    alert: svg('<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'),
    star: svg('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  };

  // All markup is either static or already escaped by renderMarkdown; parsing it with
  // DOMParser keeps it inert (no script execution) and in one auditable place.
  function setHtml(node, html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    node.replaceChildren(...doc.body.childNodes);
  }

  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  // ---------------------------------------------------------------------------
  // DOM setup
  // ---------------------------------------------------------------------------

  // A reloaded extension re-injects into open tabs; drop the stale copy first.
  document.querySelectorAll('soroagent-assistant').forEach((node) => node.remove());

  const host = document.createElement('soroagent-assistant');
  const shadow = host.attachShadow({ mode: 'closed' });
  adoptStyles(shadow, S.ASSISTANT_CSS);

  const ui = document.createElement('div');
  setHtml(ui, `
    <button class="launcher" type="button" hidden aria-label="Open SoroAgent" title="SoroAgent (Alt+Shift+K) · drag to move">${OWL}</button>
    <section class="panel" role="dialog" aria-label="SoroAgent" hidden>
      <header>
        <div class="brand"><span class="brand-mark">${OWL}</span>SoroAgent</div>
        <div class="status">
          <span class="dot" aria-hidden="true"></span>
          <span class="status-text">Not connected</span>
          <span class="where" hidden></span>
          <select class="model" aria-label="Model" hidden></select>
        </div>
        <button class="icon-btn menu-btn" type="button" aria-label="More options" aria-haspopup="menu">${ICONS.more}</button>
        <button class="icon-btn close-btn" type="button" aria-label="Close SoroAgent">${ICONS.close}</button>
        <div class="menu" role="menu" hidden>
          <button type="button" role="menuitem" data-cmd="snippets">Saved snippets</button>
          <button type="button" role="menuitem" data-cmd="clear">Clear conversation</button>
          <button type="button" role="menuitem" data-cmd="reset-position" hidden>Reset button position</button>
          <button type="button" role="menuitem" data-cmd="hide-site">Hide button on this site</button>
          <button type="button" role="menuitem" data-cmd="settings">Settings</button>
        </div>
      </header>
      <div class="actions">
        <button class="chip" type="button" data-action="summarize">${ICONS.summarize}<span>Summarize</span></button>
        <button class="chip" type="button" data-action="save">${ICONS.save}<span>Save</span></button>
      </div>
      <div class="site-bar" hidden><span class="site-label"></span></div>
      <div class="thread" aria-live="polite">
        <div class="empty">
          <strong>Hi, I'm SoroAgent</strong>
          <span class="empty-note">Runs on the model served at your local URL. Nothing leaves your machine.</span>
          <ul>
            <li><b>Summarize</b> the page</li>
            <li><b>Save</b> your selection or the page</li>
            <li>Or ask anything about the page below</li>
          </ul>
        </div>
      </div>
      <form class="composer">
        <textarea rows="1" placeholder="Ask about this page…" aria-label="Ask about this page"></textarea>
        <button class="send" type="submit" aria-label="Send">${ICONS.send}</button>
      </form>
    </section>`);
  shadow.append(...ui.childNodes);
  document.documentElement.append(host);

  const $ = (selector) => shadow.querySelector(selector);
  const els = {
    launcher: $('.launcher'),
    panel: $('.panel'),
    dot: $('.dot'),
    statusText: $('.status-text'),
    where: $('.where'),
    emptyNote: $('.empty-note'),
    model: $('.model'),
    menuBtn: $('.menu-btn'),
    menu: $('.menu'),
    resetPosition: $('[data-cmd="reset-position"]'),
    close: $('.close-btn'),
    actions: $('.actions'),
    siteBar: $('.site-bar'),
    siteLabel: $('.site-label'),
    thread: $('.thread'),
    empty: $('.empty'),
    form: $('.composer'),
    input: $('.composer textarea'),
    send: $('.send'),
  };

  // Keep the page's own keyboard shortcuts (j/k, /, space…) from firing while typing here.
  for (const type of ['keydown', 'keyup', 'keypress']) host.addEventListener(type, (e) => e.stopPropagation());

  function adoptStyles(target, css) {
    // Constructable sheets are not subject to the page's style-src CSP; fall back to <style>.
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    } catch {
      const style = document.createElement('style');
      style.textContent = css;
      (target === document ? document.documentElement : target).append(style);
    }
  }
  adoptStyles(document, S.PAGE_CSS);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const state = {
    settings: { ...S.DEFAULT_SETTINGS },
    site: S.siteFor(location),
    url: location.href,
    status: 'idle', // idle | connecting | ready | offline
    cloud: false,
    recommended: [],
    tipShown: false,
    busy: null, // AbortController of the running task
    history: [], // chat turns (without the page context)
    pageContext: null, // { url, page } used for questions
    lastSelection: { text: '', at: 0 },
    summaries: new Map(), // content fingerprint -> earlier summary, for repeat Summarize on unchanged content
    feed: null, // batches gathered by scrolling: { url, optionsKey, seen, endY, done, exhausted }
  };

  const launcherCtl = S.createLauncherController({
    host,
    launcher: els.launcher,
    panel: els.panel,
    settings: () => state.settings,
    save: (patch) => S.saveSettings(patch),
  });

  const siteOptions = () => S.siteOptionValues(state.site, state.settings);
  const pageInfo = () => (state.site.pageInfo ? state.site.pageInfo(location) : { type: 'page', label: '', context: '' });
  const items = () => state.site.items || null;
  // Prompt texts: prompts/default.js, then prompts/<site id>.js, then any inline profile prompts.
  const sitePrompts = () => S.promptsFor(state.site.id, state.site.prompts);
  const nounOne = () => ((items() && items().noun) || 'items').replace(/s$/, '');

  // FNV-1a: a fast fingerprint to tell whether content changed.
  function fingerprint(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
  }

  // ---------------------------------------------------------------------------
  // Talking to the background worker
  // ---------------------------------------------------------------------------

  function toError(payload) {
    const err = new Error(payload.error || 'Something went wrong.');
    err.code = payload.code;
    err.hint = payload.hint || '';
    return err;
  }

  async function sendMessage(message) {
    const res = await ext.runtime.sendMessage(message);
    if (res && res.ok === false) throw toError(res);
    return res;
  }

  /** Streams a completion from the model. Resolves with the full text. */
  function runChat({ messages, json = false, onToken, onThinking, signal }) {
    return new Promise((resolve, reject) => {
      const port = ext.runtime.connect({ name: 'llm' });
      let settled = false;
      const ping = setInterval(() => {
        try {
          port.postMessage({ type: 'ping' });
        } catch {
          // port already closed
        }
      }, 15000);
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearInterval(ping);
        try {
          port.disconnect();
        } catch {
          // already disconnected
        }
        fn(value);
      };
      port.onMessage.addListener((msg) => {
        if (msg.type === 'token' && onToken) onToken(msg.text);
        else if (msg.type === 'thinking' && onThinking) onThinking();
        else if (msg.type === 'done') finish(resolve, msg.text);
        else if (msg.type === 'error') finish(reject, toError(msg));
      });
      port.onDisconnect.addListener(() =>
        finish(reject, toError({ error: 'Lost the connection to the extension.', hint: 'Reload the page and try again.' }))
      );
      if (signal) {
        signal.addEventListener('abort', () => finish(reject, Object.assign(new Error('Stopped.'), { name: 'AbortError' })), { once: true });
      }
      port.postMessage({ type: 'chat', messages, json, model: els.model.value || '' });
    });
  }

  // ---------------------------------------------------------------------------
  // Connection status and model suggestions
  // ---------------------------------------------------------------------------

  function setStatus(status, text) {
    state.status = status;
    els.dot.className = `dot ${status}`;
    els.statusText.textContent = text;
    els.statusText.hidden = status === 'ready';
    els.model.hidden = status !== 'ready';
    els.where.hidden = status !== 'ready' || !state.cloud;
    updateControls();
  }

  function fillModelSelect(models, selected, recommended) {
    const option = (id, label) => el('option', { value: id, textContent: label });
    const rest = models.filter((m) => !recommended.some((r) => r.id === m.id)).map((m) => option(m.id, m.size ? `${m.id} · ${m.size}` : m.id));
    if (recommended.length) {
      els.model.replaceChildren(
        el('optgroup', { label: 'Recommended for SoroAgent' }, recommended.map((r) => option(r.id, `★ ${r.id} — ${r.label}`))),
        el('optgroup', { label: 'All models' }, rest)
      );
    } else {
      els.model.replaceChildren(...rest);
    }
    els.model.value = selected;
  }

  async function connect() {
    setStatus('connecting', 'Connecting…');
    try {
      const status = await sendMessage({ type: 'llm:status' });
      state.cloud = status.cloud;
      state.recommended = status.recommended || [];
      els.where.textContent = status.providerLabel;
      els.emptyNote.textContent = status.cloud
        ? `Runs on ${status.providerLabel} with your API key. Page text you act on is sent to ${status.providerLabel}.`
        : 'Runs on the model served at your local URL. Nothing leaves your machine.';
      if (!status.models.length) {
        setStatus('offline', 'No models');
        const pull = status.pullSuggestion ? `Download one first, for example: ${status.pullSuggestion.command}` : 'Choose a model in settings.';
        showError(new Error(`Connected to ${status.cloud ? status.providerLabel : status.baseUrl}, but it has no chat models.`), pull, true);
        return;
      }
      fillModelSelect(status.models, status.model, state.recommended);
      const via = status.cloud ? status.providerLabel : status.api === 'ollama' ? 'Ollama' : 'OpenAI-compatible API';
      els.model.title = `${status.model} via ${via} at ${status.baseUrl}`;
      setStatus('ready', status.model);
      maybeSuggestModels(status);
    } catch (err) {
      setStatus('offline', 'Offline');
      showError(err, err.hint, true);
    }
  }

  // The model suggestion appears at most once, ever: the first time a better-suited local model is
  // installed than the one in use. Choosing a model (here or in settings) also turns it off for good.
  function maybeSuggestModels(status) {
    if (state.tipShown || status.cloud || state.settings.modelTipSeen) return;
    const best = state.recommended[0];
    const inUse = status.model;
    const needsPull = status.pullSuggestion && (!best || best.id === inUse);
    if (!needsPull && (!best || best.id === inUse)) return;
    state.tipShown = true;
    S.saveSettings({ modelTipSeen: true });
    if (needsPull) {
      append(card({ icon: 'star', title: 'Tip: a better model for SoroAgent', body: `Your installed models aren't a great fit. Try ${status.pullSuggestion.reason}:`, pre: status.pullSuggestion.command }));
      return;
    }
    const node = card({
      icon: 'star',
      title: 'A better model for SoroAgent is installed',
      body: `You're using ${inUse}. Based on size and model family, these fit best. You can change this any time in the model menu or settings.`,
      actions: [{ label: 'Keep current model', onClick: () => node.remove() }],
    });
    const list = el('div', { className: 'recs' });
    for (const rec of state.recommended) {
      const use = el('button', { type: 'button', textContent: rec.id === inUse ? 'In use' : 'Use' });
      use.disabled = rec.id === inUse;
      use.addEventListener('click', () => {
        els.model.value = rec.id;
        els.model.dispatchEvent(new Event('change'));
        node.remove();
      });
      list.append(el('div', { className: 'rec' }, [el('div', {}, [el('b', { textContent: `${rec.label}: ${rec.id}` }), el('small', { textContent: rec.reason })]), use]));
    }
    node.insertBefore(list, node.querySelector('.card-actions'));
    append(node);
  }

  // ---------------------------------------------------------------------------
  // Thread rendering
  // ---------------------------------------------------------------------------

  function scrollToEnd(force) {
    const t = els.thread;
    if (force || t.scrollHeight - t.scrollTop - t.clientHeight < 80) t.scrollTop = t.scrollHeight;
  }

  function append(node) {
    els.empty.hidden = true;
    els.thread.append(node);
    scrollToEnd(true);
    return node;
  }

  const addUserMessage = (text) => append(el('div', { className: 'msg user', textContent: text }));

  // Assistant message that renders streamed Markdown at most once per frame.
  function addAssistantMessage(placeholder = 'Reading the page…') {
    const node = append(el('div', { className: 'msg assistant' }));
    setHtml(node, `<span class="typing">${S.escapeHtml(placeholder)}</span>`);
    let raw = '';
    let frame = 0;
    const render = () => {
      frame = 0;
      const visible = S.stripThinking(raw);
      if (visible) setHtml(node, S.renderMarkdown(visible));
      scrollToEnd(false);
    };
    return {
      node,
      status(text) {
        if (!raw) setHtml(node, `<span class="typing">${S.escapeHtml(text)}</span>`);
      },
      thinking() {
        if (!S.stripThinking(raw)) setHtml(node, '<span class="typing">Thinking…</span>');
      },
      push(token) {
        raw += token;
        if (!frame) frame = requestAnimationFrame(render);
      },
      finish(text) {
        if (frame) cancelAnimationFrame(frame);
        raw = text !== undefined ? text : raw;
        setHtml(node, S.renderMarkdown(S.stripThinking(raw)) || '<p><em>(no response)</em></p>');
        scrollToEnd(false);
      },
    };
  }

  function card({ kind = '', icon, title, body = '', pre = '', actions = [] }) {
    const node = el('div', { className: `card ${kind}` });
    const heading = el('div', { className: 'card-title' });
    setHtml(heading, icon ? ICONS[icon] : '');
    heading.append(el('span', { className: 'card-title-text', textContent: title }));
    node.append(heading);
    if (body) node.append(el('p', { textContent: body }));
    if (pre) node.append(el('pre', { textContent: pre }));
    if (actions.length) {
      const row = el('div', { className: 'card-actions' });
      for (const action of actions) {
        const button = el('button', { type: 'button', textContent: action.label });
        button.addEventListener('click', action.onClick);
        row.append(button);
      }
      node.append(row);
    }
    return node;
  }

  function progressCard(icon, title) {
    const node = card({ icon, title });
    const bar = el('div', { className: 'progress' }, [el('div')]);
    node.append(bar);
    append(node);
    return {
      node,
      update(text, fraction) {
        node.querySelector('.card-title-text').textContent = text;
        if (fraction !== undefined) bar.firstChild.style.width = `${Math.round(Math.min(1, fraction) * 100)}%`;
      },
    };
  }

  function showError(err, hint, offerRetry) {
    const actions = [];
    if (offerRetry) actions.push({ label: 'Retry', onClick: () => connect() });
    actions.push({ label: 'Open settings', onClick: () => sendMessage({ type: 'open:options' }) });
    return append(card({ kind: 'error', icon: 'alert', title: err.message, pre: hint || '', actions }));
  }

  // ---------------------------------------------------------------------------
  // Running tasks
  // ---------------------------------------------------------------------------

  const maxChars = () => Number(state.settings.maxPageChars) || 12000;
  const getPage = (limit = maxChars()) => S.extractPage(document, { maxChars: limit });

  function updateControls() {
    const busy = Boolean(state.busy);
    const ready = state.status === 'ready';
    for (const chip of els.actions.querySelectorAll('.chip')) chip.disabled = busy || !ready;
    els.input.disabled = !ready;
    els.send.disabled = !busy && !ready;
    els.send.classList.toggle('stop', busy);
    setHtml(els.send, busy ? ICONS.stop : ICONS.send);
    els.send.setAttribute('aria-label', busy ? 'Stop' : 'Send');
    els.launcher.classList.toggle('busy', busy);
  }

  async function runTask(task) {
    if (state.busy) return;
    if (state.status !== 'ready') await connect();
    if (state.status !== 'ready') return;
    state.busy = new AbortController();
    updateControls();
    try {
      await task(state.busy.signal);
    } catch (err) {
      if (err.name === 'AbortError') append(card({ title: 'Stopped.' }));
      else showError(err, err.hint, false);
    } finally {
      state.busy = null;
      updateControls();
    }
  }

  // Streams a reply into an assistant message; records the turn for follow-up questions.
  async function streamReply(messages, userTurn, signal, reply = addAssistantMessage()) {
    try {
      const text = await runChat({ messages, signal, onToken: reply.push, onThinking: reply.thinking });
      reply.finish(text);
      state.history.push({ role: 'user', content: userTurn }, { role: 'assistant', content: text });
      state.history = state.history.slice(-12);
      return text;
    } catch (err) {
      reply.finish();
      if (!reply.node.textContent.trim() || reply.node.textContent === '(no response)') reply.node.remove();
      throw err;
    }
  }

  // Shows a summary produced earlier for the same content instead of asking the model again.
  function showCachedSummary(label, cached, regenerate) {
    addUserMessage(label);
    addAssistantMessage().finish(cached.text);
    const minutes = Math.max(1, Math.round((Date.now() - cached.at) / 60000));
    const again = el('button', { type: 'button', textContent: 'Regenerate' });
    again.addEventListener('click', regenerate);
    append(el('div', { className: 'cached' }, [el('span', { textContent: `Nothing changed since the summary ${minutes} min ago, so here it is again.` }), again]));
  }

  // ---------------------------------------------------------------------------
  // Summarize
  // ---------------------------------------------------------------------------

  function summarize({ fresh = false } = {}) {
    const site = items();
    if (site && site.isFeed && site.isFeed(pageInfo())) return summarizeFeed({ fresh, next: false });
    if (site) {
      const posts = site.visible(document, siteOptions());
      if (posts.length) return summarizeVisibleItems(posts, { fresh });
    }
    return summarizePage({ fresh });
  }

  function summarizePage({ fresh }) {
    return runTask(async (signal) => {
      const page = getPage();
      if (!page.text) throw new Error('This page has no readable text to summarize.');
      state.pageContext = { url: location.href, page };
      const key = `page:${fingerprint(`${location.href}\n${page.text}`)}`;
      const cached = state.summaries.get(key);
      if (cached && !fresh) return showCachedSummary('Summarize this page', cached, () => summarize({ fresh: true }));
      addUserMessage('Summarize this page');
      const vars = S.pageVars(page, { context: pageInfo().context || '' });
      const text = await streamReply(S.buildMessages('summarize', vars, sitePrompts()), 'Summarize this page.', signal);
      state.summaries.set(key, { text, at: Date.now() });
    });
  }

  // Items already on screen (e.g. a thread on X): no scrolling.
  function summarizeVisibleItems(posts, { fresh }) {
    return runTask(async (signal) => {
      const key = `items:${fingerprint(location.href + JSON.stringify(siteOptions()) + posts.map((p) => p.id).join(','))}`;
      const label = `Summarize ${posts.length} ${items().noun || 'items'}`;
      const cached = state.summaries.get(key);
      if (cached && !fresh) return showCachedSummary(label, cached, () => summarize({ fresh: true }));
      addUserMessage(label);
      const text = await summarizeItems(posts, { start: 1, context: pageInfo().context || '', signal, label });
      state.summaries.set(key, { text, at: Date.now() });
    });
  }

  // Formats items and summarizes them. Batches longer than the page-text limit are summarized
  // in parts (notes per part), then the notes are merged into one summary.
  async function summarizeItems(list, { start, context, signal, label }) {
    const site = items();
    const prompts = sitePrompts();
    const budget = maxChars();
    const groups = [];
    let group = [];
    let size = 0;
    for (const item of list) {
      const length = site.format([item], { start: 1 }).length + 2;
      if (group.length && size + length > budget) {
        groups.push(group);
        group = [];
        size = 0;
      }
      group.push(item);
      size += length;
    }
    if (group.length) groups.push(group);

    const base = { title: document.title, url: location.href, text: '' };
    const noun = site.noun || 'items';
    const reply = addAssistantMessage(`Reading ${list.length} ${noun}…`);
    let content = site.format(list, { start });
    let fullContext = context;
    if (groups.length > 1) {
      const notes = [];
      let offset = start;
      for (let i = 0; i < groups.length; i++) {
        reply.status(`Reading part ${i + 1} of ${groups.length}…`);
        const vars = S.pageVars({ ...base, text: site.format(groups[i], { start: offset }) }, { context: `${context} (Part ${i + 1} of ${groups.length}.)`, count: groups[i].length });
        try {
          notes.push(`--- Part ${i + 1} ---\n${await runChat({ messages: S.buildMessages('notes', vars, prompts), signal })}`);
        } catch (err) {
          reply.node.remove();
          throw err;
        }
        offset += groups[i].length;
      }
      reply.status('Writing the summary…');
      content = notes.join('\n\n');
      fullContext = `${context} The content below is notes taken on ${list.length} ${noun} in ${groups.length} parts.`;
    }
    const vars = S.pageVars({ ...base, text: content }, { context: fullContext, count: list.length });
    const text = await streamReply(S.buildMessages('summarize', vars, prompts), label, signal, reply);
    // Follow-up questions are answered from these items.
    const asText = site.format(list, { start });
    state.pageContext = { url: location.href, page: { ...base, text: asText.slice(0, budget), truncated: asText.length > budget } };
    return text;
  }

  // Feeds (e.g. X search): gather a batch by scrolling, summarize it, then offer the next batch.
  function summarizeFeed({ fresh, next }) {
    const site = items();
    const info = pageInfo();
    const options = siteOptions();
    const optionsKey = JSON.stringify(options);
    const target = site.batchSize || 100;
    const noun = site.noun || 'items';
    if (!state.feed || state.feed.url !== location.href || state.feed.optionsKey !== optionsKey) {
      state.feed = { url: location.href, optionsKey, seen: new Set(), endY: undefined, done: 0, exhausted: false };
    }
    const feed = state.feed;

    return runTask(async (signal) => {
      // The feed counts as unchanged when every post on screen was part of the earlier first batch
      // (sites like X unload posts as you scroll, so "what's at the top" isn't stable on its own).
      const key = `feed:${fingerprint(location.href + optionsKey)}`;
      const label = next ? `Summarize the next ${target} ${noun}` : `Summarize ${target} ${noun}${info.label ? ` · ${info.label}` : ''}`;
      const cached = !next && state.summaries.get(key);
      // Only posts inside the viewport: sites keep extra posts loaded above and below it.
      const onScreen = site
        .visible(document, options)
        .filter((p) => {
          const target = site.element(p);
          const rect = target && target.getBoundingClientRect();
          return rect && rect.bottom > 0 && rect.top < window.innerHeight;
        })
        .map((p) => p.id);
      const unchanged = cached && onScreen.length > 0 && onScreen.every((postId) => cached.ids.has(postId));
      if (unchanged && !fresh) {
        showCachedSummary(label, cached.summary, () => summarizeFeed({ fresh: true, next: false }));
        if (feed.done < cached.feed.done) Object.assign(feed, cached.feed, { seen: new Set(cached.feed.seen) });
        offerNextBatch(feed, target);
        return;
      }
      if (!next) Object.assign(feed, { seen: new Set(), endY: undefined, done: 0, exhausted: false });

      addUserMessage(label);
      const progress = progressCard('summarize', `Gathering ${noun}… 0 of ${target}`);
      const startY = window.scrollY;
      let result;
      try {
        result = await site.collect({
          target,
          skip: feed.seen,
          options,
          signal,
          fromY: next ? feed.endY : undefined,
          onProgress: (count) => progress.update(`Gathering ${noun}… ${count} of ${target}`, count / target),
        });
      } finally {
        progress.node.remove();
        window.scrollTo({ top: startY }); // put the reader back where they were
      }
      if (!result.items.length) {
        append(card({ title: next ? `No more ${noun} found.` : `No ${noun} found on this page.` }));
        return;
      }
      for (const item of result.items) feed.seen.add(item.id);
      const start = feed.done + 1;
      feed.done += result.items.length;
      feed.endY = result.endY;
      feed.exhausted = result.exhausted;

      const context = `${info.context || ''}${next ? ` This batch is ${noun} ${start} to ${feed.done}.` : ''}`;
      const text = await summarizeItems(result.items, { start, context, signal, label });
      if (!next) {
        // Posts above the starting point were on screen when Summarize was clicked; remember them too.
        const ids = new Set([...feed.seen, ...onScreen]);
        state.summaries.set(key, { summary: { text, at: Date.now() }, ids, feed: { ...feed, seen: [...feed.seen] } });
      }
      offerNextBatch(feed, target);
    });
  }

  function offerNextBatch(feed, target) {
    const noun = items().noun || 'items';
    if (feed.exhausted) {
      append(card({ icon: 'check', kind: 'ok', title: `Summarized ${feed.done} ${noun}: that's all that loaded.` }));
      return;
    }
    const node = card({
      title: `Summarized ${noun} 1–${feed.done}. Summarize the next ${target}?`,
      body: "SoroAgent scrolls further down to gather them, then returns you to where you were.",
      actions: [
        {
          label: `Yes, next ${target}`,
          onClick: () => {
            node.remove();
            summarizeFeed({ fresh: false, next: true });
          },
        },
        { label: 'Not now', onClick: () => node.remove() },
      ],
    });
    append(node);
  }

  // ---------------------------------------------------------------------------
  // Ask
  // ---------------------------------------------------------------------------

  function currentContext() {
    const site = items();
    if (site) {
      const posts = site.visible(document, siteOptions());
      if (posts.length) {
        const text = site.format(posts, { start: 1 });
        return { title: document.title, url: location.href, text: text.slice(0, maxChars()), truncated: text.length > maxChars() };
      }
    }
    return getPage();
  }

  function ask(question) {
    return runTask(async (signal) => {
      if (!state.pageContext || state.pageContext.url !== location.href) {
        state.pageContext = { url: location.href, page: currentContext() };
        state.history = [];
      }
      addUserMessage(question);
      const vars = S.pageVars(state.pageContext.page, { context: pageInfo().context || '', question });
      const [system] = S.buildMessages('ask', vars, sitePrompts());
      await streamReply([system, ...state.history, { role: 'user', content: question }], question, signal);
    });
  }

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  function save(selectionText) {
    const recent = Date.now() - state.lastSelection.at < 2 * 60 * 1000 ? state.lastSelection.text : '';
    const selection = (selectionText || S.currentSelection() || recent).trim();

    return runTask(async (signal) => {
      let text = selection;
      let url = location.href;
      let source = 'selection';
      const site = items();
      if (!text && site && site.focused) {
        const item = site.focused(document, location);
        if (item) {
          text = site.describe ? site.describe(item) : item.text;
          url = item.url || url;
          source = 'item';
        }
      }
      const page = getPage();
      if (!text) {
        text = page.text;
        source = 'page';
      }
      if (!text) throw new Error('Nothing to save: select some text or open a page with readable content.');

      const what = { selection: 'your selection', item: `this ${nounOne()}`, page: 'this page' }[source];
      const progress = append(card({ icon: 'save', title: `Saving ${what}…` }));
      let meta;
      let warning = '';
      try {
        const vars = S.pageVars({ title: page.title, url, text: text.slice(0, 6000) }, { context: pageInfo().context || '' });
        const reply = await runChat({ messages: S.buildMessages('save', vars, sitePrompts()), json: true, signal });
        meta = S.parseSnippetMeta(reply, page.title);
      } catch (err) {
        if (err.name === 'AbortError') {
          progress.remove();
          throw err;
        }
        meta = S.parseSnippetMeta('', page.title);
        warning = `Saved without an AI summary: ${err.message}`;
      }

      const snippet = await S.addSnippet({ ...meta, text, source: source === 'page' ? 'page' : 'selection', url, pageTitle: page.title, model: els.model.value });
      state.lastSelection = { text: '', at: 0 };

      const done = card({
        kind: 'ok',
        icon: 'check',
        title: `Saved: ${snippet.title}`,
        body: warning || snippet.summary,
        actions: [{ label: 'Open snippets', onClick: () => sendMessage({ type: 'open:snippets' }) }],
      });
      if (snippet.tags.length) {
        done.insertBefore(el('div', { className: 'tags' }, snippet.tags.map((tag) => el('span', { className: 'tag', textContent: `#${tag}` }))), done.querySelector('.card-actions'));
      }
      progress.replaceWith(done);
    });
  }

  // ---------------------------------------------------------------------------
  // Site bar: page label and the site's toggles
  // ---------------------------------------------------------------------------

  function renderSiteBar() {
    const site = state.site;
    els.siteBar.hidden = site.id === 'default';
    els.input.placeholder = items() ? `Ask about these ${items().noun || 'items'}…` : 'Ask about this page…';
    if (els.siteBar.hidden) return;
    els.siteLabel.textContent = pageInfo().label || site.name;
    els.siteBar.querySelectorAll('.toggle').forEach((t) => t.remove());
    const values = siteOptions();
    for (const option of site.options || []) {
      const toggle = el('button', { type: 'button', className: 'toggle', textContent: option.label, title: option.title || '' });
      toggle.setAttribute('aria-pressed', String(values[option.id]));
      toggle.addEventListener('click', () => {
        const all = { ...(state.settings.siteOptions || {}) };
        all[site.id] = { ...siteOptions(), [option.id]: !values[option.id] };
        S.saveSettings({ siteOptions: all });
      });
      els.siteBar.append(toggle);
    }
  }

  function applySiteOptions() {
    if (!state.site.applyOptions) return;
    try {
      state.site.applyOptions(siteOptions());
    } catch (err) {
      console.warn('[SoroAgent] Site options failed:', err);
    }
  }

  // Single-page apps (like X) change the URL without reloading.
  setInterval(() => {
    if (location.href === state.url) return;
    state.url = location.href;
    const site = S.siteFor(location);
    if (site !== state.site) {
      state.site = site;
      applySiteOptions();
    }
    state.pageContext = null;
    renderSiteBar();
  }, 800);

  // ---------------------------------------------------------------------------
  // Panel open / close and events
  // ---------------------------------------------------------------------------

  const isOpen = () => !els.panel.hidden;

  function openPanel() {
    if (!isOpen()) {
      els.panel.hidden = false;
      els.launcher.classList.add('open');
      renderSiteBar();
      launcherCtl.placePanel();
      if (state.status !== 'ready') connect();
    }
    els.input.focus({ preventScroll: true });
  }

  function closePanel() {
    els.panel.hidden = true;
    els.menu.hidden = true;
    els.launcher.classList.remove('open');
  }

  function applySettings() {
    const hiddenHere = (state.settings.hiddenSites || []).includes(location.hostname);
    els.launcher.hidden = !state.settings.showLauncher || hiddenHere;
    els.resetPosition.hidden = !launcherCtl.hasCustomPlacement();
    launcherCtl.place();
    launcherCtl.placePanel();
  }

  els.launcher.addEventListener('click', () => (isOpen() ? closePanel() : openPanel()));
  els.close.addEventListener('click', closePanel);
  els.panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePanel();
  });

  els.actions.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const action = chip.dataset.action;
    if (action === 'summarize') summarize();
    else if (action === 'save') save();
  });

  // Clicking a chip would otherwise clear the user's text selection on the page.
  els.actions.addEventListener('mousedown', (e) => e.preventDefault());

  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) {
      state.busy.abort();
      return;
    }
    const question = els.input.value.trim();
    if (!question) return;
    els.input.value = '';
    els.input.style.height = '';
    ask(question);
  });

  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  });
  els.input.addEventListener('input', () => {
    els.input.style.height = 'auto';
    els.input.style.height = `${Math.min(els.input.scrollHeight, 140)}px`;
  });

  els.model.addEventListener('change', () => {
    // Picking a model counts as an answer to the model suggestion.
    S.saveSettings({ ...S.modelPatch(state.settings, els.model.value), modelTipSeen: true });
    els.statusText.textContent = els.model.value;
  });

  els.menuBtn.addEventListener('click', () => {
    els.menu.hidden = !els.menu.hidden;
  });
  els.menu.addEventListener('click', async (e) => {
    const cmd = e.target.closest('[data-cmd]')?.dataset.cmd;
    els.menu.hidden = true;
    if (cmd === 'snippets') sendMessage({ type: 'open:snippets' });
    else if (cmd === 'settings') sendMessage({ type: 'open:options' });
    else if (cmd === 'clear') {
      state.history = [];
      state.pageContext = null;
      els.thread.querySelectorAll('.msg, .card, .cached').forEach((n) => n.remove());
      els.empty.hidden = false;
    } else if (cmd === 'reset-position') {
      const placements = { ...(state.settings.launcherPlacements || {}) };
      delete placements[location.hostname];
      await S.saveSettings({ launcherPlacements: placements });
    } else if (cmd === 'hide-site') {
      const sites = new Set(state.settings.hiddenSites || []);
      sites.add(location.hostname);
      await S.saveSettings({ hiddenSites: [...sites] });
      closePanel();
    }
  });
  shadow.addEventListener('click', (e) => {
    if (!els.menu.hidden && !e.target.closest('.menu, .menu-btn')) els.menu.hidden = true;
  });

  // Remember the last selection: some sites clear it when focus moves into the panel.
  document.addEventListener('selectionchange', () => {
    const text = S.currentSelection();
    if (text) state.lastSelection = { text, at: Date.now() };
  });

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('assistant:')) return false;
    if (msg.type === 'assistant:toggle') {
      if (isOpen()) closePanel();
      else openPanel();
    } else if (msg.type === 'assistant:run') {
      openPanel();
      if (msg.action === 'summarize') summarize();
      else if (msg.action === 'save') save(msg.selectionText);
    }
    sendResponse({ ok: true });
    return false;
  });

  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.keysVersion) {
      if (isOpen()) connect();
      return;
    }
    if (!changes.settings) return;
    const before = state.settings;
    state.settings = { ...S.DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) };
    applySettings();
    if (JSON.stringify(before.siteOptions) !== JSON.stringify(state.settings.siteOptions)) {
      applySiteOptions();
      renderSiteBar();
    }
    const keys = ['source', 'baseUrl', 'provider', 'apiKey', 'cloudProvider', 'customBaseUrl'];
    if (keys.some((k) => before[k] !== state.settings[k]) && isOpen()) connect();
  });

  S.getSettings().then((settings) => {
    state.settings = settings;
    applySettings();
    applySiteOptions();
  });
  updateControls();
})();
