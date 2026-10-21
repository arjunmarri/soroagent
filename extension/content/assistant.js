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
  // The SoroAgent owl (extension/shared/brand.js). No baked-in background: the button's
  // background follows the browser's light or dark theme.
  const OWL = S.BRAND.owlSvg({ frame: 'circle', background: false });
  const OWL_MARK = S.BRAND.owlSvg({ frame: 'tile', background: false, className: 'owl mark' });
  const ICONS = {
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    more: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'),
    summarize: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
    save: svg('<path d="M6 3h12v18l-6-4-6 4z"/>'),
    clean: svg('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5.5 0 9 5 10 7a17 17 0 0 1-3 3.8M6.3 6.3C3.9 7.9 2.5 10.4 2 12c1 2 4.5 7 10 7 1.6 0 3-.4 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
    research: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8 11h6M11 8v6"/>'),
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
        <div class="brand"><span class="brand-mark">${OWL_MARK}</span>SoroAgent</div>
        <div class="status">
          <span class="dot" aria-hidden="true"></span>
          <span class="status-text">Not connected</span>
          <span class="where" hidden></span>
          <select class="model" aria-label="Model" hidden></select>
        </div>
        <button class="icon-btn menu-btn" type="button" aria-label="More options" aria-haspopup="menu">${ICONS.more}</button>
        <button class="icon-btn close-btn" type="button" aria-label="Close SoroAgent">${ICONS.close}</button>
        <div class="menu" role="menu" hidden>
          <button type="button" role="menuitem" data-cmd="history">Summary history</button>
          <button type="button" role="menuitem" data-cmd="snippets">Saved snippets</button>
          <button type="button" role="menuitem" data-cmd="clear">Clear conversation</button>
          <button type="button" role="menuitem" data-cmd="reset-position" hidden>Reset button position</button>
          <button type="button" role="menuitem" data-cmd="hide-site">Hide button on this site</button>
          <button type="button" role="menuitem" data-cmd="settings">Settings</button>
        </div>
      </header>
      <div class="actions">
        <button class="chip" type="button" data-action="summarize">${ICONS.summarize}<span>Summarize</span></button>
        <button class="chip" type="button" data-action="declutter" title="Hide ads and distractions without changing the page layout">${ICONS.clean}<span>Hide ads</span></button>
      </div>
      <div class="site-bar" hidden><span class="site-label"></span></div>
      <div class="thread" aria-live="polite">
        <div class="empty">
          <strong>Hi, I'm SoroAgent</strong>
          <span class="empty-note">Runs on the model served at your local URL. Nothing leaves your machine.</span>
          <ul>
            <li><b>Summarize</b> the page. It keeps going if you leave, and every summary is kept in your history</li>
            <li><b>Hide ads</b> and distractions, keeping the layout</li>
            <li>Every summary is <b>saved</b> to your snippets; <b>Research</b> any of them further on the web</li>
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
  adoptStyles(document, S.DECLUTTER_CSS);

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
  // Prompt texts: prompts/default.js, then prompts/<site id>.js and its page-type overrides.
  const sitePrompts = () => S.promptsFor(state.site.id, state.site.prompts, pageInfo().type);
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
    if (site && site.isFeed && site.isFeed(pageInfo())) return summarizeFeed({ fresh });
    if (site) {
      const posts = site.visible(document, siteOptions());
      if (posts.length) return summarizeVisibleItems(posts, { fresh });
    }
    return summarizePage({ fresh });
  }

  // ---------------------------------------------------------------------------
  // Summary jobs: the background worker runs each summary, so it finishes even if the reader
  // leaves the page. Results are kept in the summary history.
  // ---------------------------------------------------------------------------

  const NOTES_PLACEHOLDER = '@@SOROAGENT_NOTES@@';

  /** Connects a reply bubble to a job (new or running). Resolves with the finished record. */
  function followJob(port, reply, { signal, onStarted, onSources } = {}) {
    return new Promise((resolve, reject) => {
      let id = '';
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        try {
          port.disconnect();
        } catch {
          // already closed
        }
        fn(value);
      };
      port.onMessage.addListener((msg) => {
        if (msg.type === 'started') {
          id = msg.id;
          if (onStarted) onStarted(id);
        } else if (msg.type === 'snapshot') {
          id = msg.record.id;
          if (msg.record.text) reply.push(msg.record.text);
          else if (msg.record.statusText) reply.status(msg.record.statusText);
        } else if (msg.type === 'status') reply.status(msg.text);
        else if (msg.type === 'sources' && onSources) onSources(msg);
        else if (msg.type === 'thinking') reply.thinking();
        else if (msg.type === 'token') reply.push(msg.text);
        else if (msg.type === 'done') {
          reply.finish(msg.record.text);
          finish(resolve, msg.record);
        } else if (msg.type === 'error' || msg.type === 'gone') {
          const record = msg.record || {};
          finish(reject, record.status === 'stopped' ? Object.assign(new Error('Stopped.'), { name: 'AbortError' }) : toError(record));
        }
      });
      port.onDisconnect.addListener(() => finish(reject, toError({ error: 'Lost the connection to the extension.', hint: 'Reload the page; the summary is in your summary history.' })));
      if (signal) {
        signal.addEventListener('abort', () => {
          if (id) port.postMessage({ type: 'stop', id });
          finish(reject, Object.assign(new Error('Stopped.'), { name: 'AbortError' }));
        }, { once: true });
      }
    });
  }

  /**
   * Runs a summary as a background job and streams it into a reply bubble.
   * job: { label, kind, fingerprint, final (messages), notes (list of messages; optional) }
   */
  async function runSummaryJob(job, { signal, reply, onSources }) {
    const port = ext.runtime.connect({ name: 'summary' });
    const done = followJob(port, reply, { signal, onSources });
    // Every summary is saved as a snippet; the background labels it with this prompt.
    const saveMessages =
      job.kind === 'research'
        ? undefined
        : S.buildMessages('save', S.pageVars({ title: document.title, url: location.href, text: S.JOB_PLACEHOLDERS.summary }), sitePrompts());
    port.postMessage({
      type: 'start',
      job: {
        saveMessages,
        ...job,
        placeholder: NOTES_PLACEHOLDER,
        url: location.href,
        pageTitle: document.title,
        site: state.site.id === 'default' ? location.hostname : state.site.name,
        model: els.model.value || '',
      },
    });
    try {
      const record = await done;
      state.history.push({ role: 'user', content: job.label }, { role: 'assistant', content: record.text });
      state.history = state.history.slice(-12);
      afterJob(record);
      return record;
    } catch (err) {
      if (!reply.node.textContent.trim() || /Reading|Writing|Thinking/.test(reply.node.textContent)) reply.node.remove();
      throw err;
    }
  }

  // An earlier summary of exactly this content (from the summary history), if any.
  async function findSummary(print) {
    try {
      const res = await sendMessage({ type: 'summary:find', url: location.href, fingerprint: print });
      return res.record ? { text: res.record.text, at: Date.parse(res.record.finishedAt || res.record.createdAt) } : null;
    } catch {
      return null;
    }
  }

  function summarizePage({ fresh }) {
    return runTask(async (signal) => {
      const page = getPage();
      if (!page.text) throw new Error('This page has no readable text to summarize.');
      state.pageContext = { url: location.href, page };
      const print = fingerprint(`${location.href}\n${page.text}`);
      const cached = !fresh && (await findSummary(print));
      if (cached) return showCachedSummary('Summarize this page', cached, () => summarize({ fresh: true }));
      addUserMessage('Summarize this page');
      const vars = S.pageVars(page, { context: pageInfo().context || '' });
      await runSummaryJob(
        { label: 'Summarize this page', kind: 'page', fingerprint: print, final: S.buildMessages('summarize', vars, sitePrompts()) },
        { signal, reply: addAssistantMessage() }
      );
    });
  }

  // Items already on screen (e.g. a thread on X or Reddit): no scrolling.
  function summarizeVisibleItems(posts, { fresh }) {
    return runTask(async (signal) => {
      const print = fingerprint(location.href + JSON.stringify(siteOptions()) + posts.map((p) => p.id).join(','));
      const label = `Summarize ${posts.length} ${items().noun || 'items'}`;
      const cached = !fresh && (await findSummary(print));
      if (cached) return showCachedSummary(label, cached, () => summarize({ fresh: true }));
      addUserMessage(label);
      await summarizeItems(posts, { start: 1, context: pageInfo().context || '', signal, label, print });
    });
  }

  // Formats items and summarizes them as a background job. Batches longer than the page-text
  // limit are summarized in parts (notes per part), then the notes are merged into one summary.
  async function summarizeItems(list, { start, context, signal, label, print = '' }) {
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
    const notes = [];
    let content = site.format(list, { start });
    let fullContext = context;
    if (groups.length > 1) {
      let offset = start;
      for (let i = 0; i < groups.length; i++) {
        const vars = S.pageVars({ ...base, text: site.format(groups[i], { start: offset }) }, { context: `${context} (Part ${i + 1} of ${groups.length}.)`, count: groups[i].length });
        notes.push(S.buildMessages('notes', vars, prompts));
        offset += groups[i].length;
      }
      content = NOTES_PLACEHOLDER;
      fullContext = `${context} The content below is notes taken on ${list.length} ${noun} in ${groups.length} parts.`;
    }
    const vars = S.pageVars({ ...base, text: content }, { context: fullContext, count: list.length });
    const { text } = await runSummaryJob(
      { label, kind: 'items', fingerprint: print, notes, final: S.buildMessages('summarize', vars, prompts) },
      { signal, reply: addAssistantMessage(`Reading ${list.length} ${noun}…`) }
    );
    // Follow-up questions are answered from these items.
    const asText = site.format(list, { start });
    state.pageContext = { url: location.href, page: { ...base, text: asText.slice(0, budget), truncated: asText.length > budget } };
    return text;
  }

  // Under each finished summary: it's saved, and it can be researched further.
  function afterJob(record) {
    if (record.kind === 'research') {
      if (record.sources && record.sources.length) append(sourcesCard(record.query, record.sources, 'Sources'));
      return;
    }
    const research = el('button', { type: 'button', textContent: 'Research this further' });
    research.addEventListener('click', () => runResearch(record));
    const open = el('button', { type: 'button', textContent: 'Open snippets' });
    open.addEventListener('click', () => sendMessage({ type: 'open:snippets' }));
    append(el('div', { className: 'card ok saved' }, [
      el('div', { className: 'card-title' }, [el('span', { className: 'card-title-text', textContent: record.snippetId ? '✓ Saved to your snippets' : 'Summary kept in your history' })]),
      el('p', { textContent: 'Research looks this topic up on the web, reads the top sources and writes a cited brief.' }),
      el('div', { className: 'card-actions' }, [research, open]),
    ]));
  }

  function sourcesCard(query, sources, title) {
    const list = el('ol', { className: 'sources' }, sources.map((src) => {
      let host = '';
      try {
        host = new URL(src.url).hostname.replace(/^www\./, '');
      } catch {
        // keep empty
      }
      return el('li', {}, [el('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer', textContent: src.title || host }), el('small', { textContent: ` ${host}` })]);
    }));
    return el('div', { className: 'card' }, [
      el('div', { className: 'card-title' }, [el('span', { className: 'card-title-text', textContent: `${title}${query ? ` · searched “${query}”` : ''}` })]),
      list,
    ]);
  }

  // Research: search the web for the summary's topic, read the top sources, write a cited brief.
  function runResearch(record) {
    return runTask(async (signal) => {
      const title = record.pageTitle || document.title;
      addUserMessage(`Research: ${title}`);
      const seed = S.pageVars({ title, url: record.url || location.href, text: record.text.slice(0, 4000) });
      let shown = false;
      await runSummaryJob(
        {
          label: `Research: ${title}`,
          kind: 'research',
          snippetId: record.snippetId || '',
          fallbackQuery: title,
          queryMessages: S.buildMessages('researchQuery', seed, sitePrompts()),
          final: S.buildMessages('research', S.pageVars(
            { title, url: record.url || location.href, text: S.JOB_PLACEHOLDERS.sources },
            { context: record.text.slice(0, 3000), question: S.JOB_PLACEHOLDERS.query }
          ), sitePrompts()),
        },
        {
          signal,
          reply: addAssistantMessage('Choosing what to search for…'),
          onSources: (msg) => {
            if (shown) return;
            shown = true;
            els.thread.insertBefore(sourcesCard(msg.query, msg.sources, 'Reading'), els.thread.lastElementChild);
          },
        }
      );
    });
  }

  // Hide ads: keeps the layout; can be remembered per site.
  function updateDeclutterChip() {
    const chip = els.actions.querySelector('[data-action="declutter"]');
    const on = S.declutter.isActive();
    chip.classList.toggle('active', on);
    chip.querySelector('span').textContent = on ? 'Show ads' : 'Hide ads';
  }

  function toggleDeclutter() {
    const host = location.hostname;
    if (S.declutter.isActive()) {
      S.declutter.showAds();
      updateDeclutterChip();
      append(card({ title: 'Ads and distractions are back.' }));
      return;
    }
    const count = S.declutter.hideAds();
    updateDeclutterChip();
    const remembered = (state.settings.cleanSites || []).includes(host);
    const always = el('button', { type: 'button', textContent: remembered ? `Stop hiding automatically on ${host}` : `Always hide on ${host}` });
    always.addEventListener('click', async () => {
      const sites = new Set(state.settings.cleanSites || []);
      if (sites.has(host)) sites.delete(host);
      else sites.add(host);
      await S.saveSettings({ cleanSites: [...sites] });
      always.textContent = sites.has(host) ? `Stop hiding automatically on ${host}` : `Always hide on ${host}`;
    });
    const undo = el('button', { type: 'button', textContent: 'Show them again' });
    undo.addEventListener('click', () => {
      if (S.declutter.isActive()) toggleDeclutter();
    });
    append(el('div', { className: 'card ok' }, [
      el('div', { className: 'card-title' }, [el('span', { className: 'card-title-text', textContent: count ? `Hid ${count} ad${count === 1 ? '' : 's'} and distraction${count === 1 ? '' : 's'}.` : 'No ads found right now. New ones will be hidden as they load.' })]),
      el('p', { textContent: 'The page layout stays exactly the same; only the clutter is gone.' }),
      el('div', { className: 'card-actions' }, [undo, always]),
    ]));
  }

  // Coming back to a page: show summaries that finished while the reader was away, and
  // reconnect to ones still running.
  async function showPendingSummaries() {
    let records = [];
    try {
      records = (await sendMessage({ type: 'summary:for-url', url: location.href })).records || [];
    } catch {
      return;
    }
    const relevant = records.filter((r) => r.status !== 'running' || r.live);
    if (!relevant.length) return;
    openPanel({ focus: false });
    const seen = [];
    for (const record of relevant) {
      const when = new Date(record.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      if (record.status === 'running') {
        append(card({ icon: 'summarize', title: `Still working on "${record.label}" (started ${when}).`, body: 'It kept running while you were away.' }));
        const reply = addAssistantMessage(record.statusText || 'Summarizing…');
        const port = ext.runtime.connect({ name: 'summary' });
        followJob(port, reply).then((finished) => {
          state.history.push({ role: 'user', content: record.label }, { role: 'assistant', content: finished.text });
          afterJob(finished);
          sendMessage({ type: 'summary:seen', ids: [record.id] }).catch(() => {});
        }).catch((err) => showError(err, err.hint, false));
        port.postMessage({ type: 'attach', id: record.id });
        continue;
      }
      seen.push(record.id);
      if (record.status === 'done') {
        append(card({ kind: 'ok', icon: 'check', title: `Finished while you were away: ${record.label}`, body: `Started at ${when}.` }));
        addAssistantMessage().finish(record.text);
        state.history.push({ role: 'user', content: record.label }, { role: 'assistant', content: record.text });
        afterJob(record);
      } else if (record.status !== 'stopped') {
        showError(new Error(`"${record.label}" didn't finish: ${record.error || record.status}`), record.hint, false);
      }
    }
    if (seen.length) sendMessage({ type: 'summary:seen', ids: seen }).catch(() => {});
  }

  // Feeds (X, Reddit): Summarize reads only what's already loaded, then offers "Read more".
  // Reading more is always the reader's choice, one bounded batch at a time, and stops for good at a
  // per-page limit, so it can't turn into doom-scrolling.
  const readMoreLimit = () => Math.max(20, Number(state.settings.readMoreLimit) || 200);

  function inViewport(site, item) {
    const target = site.element(item);
    const rect = target && target.getBoundingClientRect();
    return Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight);
  }

  function summarizeFeed({ fresh }) {
    const site = items();
    const info = pageInfo();
    const options = siteOptions();
    const optionsKey = JSON.stringify(options);
    const noun = site.noun || 'items';

    return runTask(async (signal) => {
      const loaded = site.visible(document, options);
      if (!loaded.length) {
        append(card({ title: `No ${noun} found on this page yet.`, body: 'Wait for the page to load, then try again.' }));
        return;
      }
      // Unchanged since the last summary: every post on screen was part of it.
      const key = `feed:${fingerprint(location.href + optionsKey)}`;
      const cached = state.summaries.get(key);
      const onScreen = loaded.filter((p) => inViewport(site, p)).map((p) => p.id);
      const unchanged = cached && onScreen.length > 0 && onScreen.every((postId) => cached.ids.has(postId));
      const label = `Summarize ${loaded.length} loaded ${noun}${info.label ? ` · ${info.label}` : ''}`;
      if (unchanged && !fresh) {
        showCachedSummary(cached.label, cached.summary, () => summarize({ fresh: true }));
        if (!state.feed || state.feed.url !== location.href) state.feed = { ...cached.feed, seen: new Set(cached.feed.seen) };
        offerReadMore();
        return;
      }

      state.feed = { url: location.href, optionsKey, seen: new Set(loaded.map((p) => p.id)), endY: undefined, done: loaded.length, exhausted: false };
      addUserMessage(label);
      const context = `${info.context || ''} These are the ${noun} currently loaded on the page.`;
      const text = await summarizeItems(loaded, { start: 1, context, signal, label });
      state.summaries.set(key, {
        label,
        summary: { text, at: Date.now() },
        ids: new Set(loaded.map((p) => p.id)),
        feed: { ...state.feed, seen: [...state.feed.seen] },
      });
      offerReadMore();
    });
  }

  function readMore() {
    const site = items();
    const feed = state.feed;
    if (!site || !feed || feed.url !== location.href) return summarize();
    const info = pageInfo();
    const options = siteOptions();
    const noun = site.noun || 'items';
    const target = Math.min(site.batchSize || 50, readMoreLimit() - feed.done);
    if (target <= 0) return offerReadMore();

    return runTask(async (signal) => {
      addUserMessage(`Read ${target} more ${noun}`);
      const progress = progressCard('summarize', `Loading more ${noun}… 0 of ${target}`);
      const startY = window.scrollY;
      let result;
      try {
        result = await site.collect({
          target,
          skip: feed.seen,
          options,
          signal,
          fromY: feed.endY ?? window.scrollY,
          onProgress: (count) => progress.update(`Loading more ${noun}… ${count} of ${target}`, count / target),
        });
      } finally {
        progress.node.remove();
        window.scrollTo({ top: startY }); // back to where the reader was
      }
      feed.endY = result.endY;
      feed.exhausted = result.exhausted;
      if (!result.items.length) {
        feed.exhausted = true;
        offerReadMore();
        return;
      }
      for (const item of result.items) feed.seen.add(item.id);
      const start = feed.done + 1;
      feed.done += result.items.length;
      const context = `${info.context || ''} This batch is ${noun} ${start} to ${feed.done}, loaded after the ones already summarized.`;
      await summarizeItems(result.items, { start, context, signal, label: `Read ${target} more ${noun}` });
      offerReadMore();
    });
  }

  function offerReadMore() {
    const site = items();
    const feed = state.feed;
    if (!site || !feed) return;
    const noun = site.noun || 'items';
    const limit = readMoreLimit();
    if (feed.done >= limit) {
      append(card({
        icon: 'check',
        kind: 'ok',
        title: `You've caught up on ${feed.done} ${noun} here.`,
        body: `That's the limit for this page, so SoroAgent stops reading more here. Maybe take a break 🦉 (You can change the limit in settings.)`,
      }));
      return;
    }
    if (feed.exhausted) {
      append(card({ icon: 'check', kind: 'ok', title: `Summarized ${feed.done} ${noun}: that's everything that loaded.` }));
      return;
    }
    const next = Math.min(site.batchSize || 50, limit - feed.done);
    const node = card({
      title: `Summarized ${noun} 1–${feed.done}. Would you like to read more?`,
      body: `SoroAgent will scroll to load up to ${next} more, summarize only the new ones, then bring you back to where you are. It stops after ${limit} ${noun} on this page.`,
      actions: [
        {
          label: `Read ${next} more`,
          onClick: () => {
            node.remove();
            readMore();
          },
        },
        { label: 'No thanks', onClick: () => node.remove() },
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
    showPendingSummaries();
  }, 800);

  // ---------------------------------------------------------------------------
  // Panel open / close and events
  // ---------------------------------------------------------------------------

  const isOpen = () => !els.panel.hidden;

  function openPanel({ focus = true } = {}) {
    if (!isOpen()) {
      els.panel.hidden = false;
      els.launcher.classList.add('open');
      renderSiteBar();
      launcherCtl.placePanel();
      if (state.status !== 'ready') connect();
    }
    if (focus) els.input.focus({ preventScroll: true });
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
    else if (action === 'declutter') toggleDeclutter();
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
    else if (cmd === 'history') sendMessage({ type: 'open:history' });
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

  // Keep the toolbar icon in step with the browser's light/dark theme.
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const reportTheme = () => ext.runtime.sendMessage({ type: 'theme', dark: darkQuery.matches }).catch(() => {});
  darkQuery.addEventListener('change', reportTheme);
  // Also re-check when the tab comes back into view (the theme may have changed meanwhile).
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) reportTheme();
  });
  reportTheme();

  S.getSettings().then((settings) => {
    state.settings = settings;
    applySettings();
    applySiteOptions();
    showPendingSummaries();
    // Sites where the reader chose "Always hide": clean up once the page (and its ads) has loaded.
    if ((settings.cleanSites || []).includes(location.hostname)) {
      setTimeout(() => {
        S.declutter.hideAds();
        updateDeclutterChip();
      }, 1200);
    }
  });
  updateControls();
})();
