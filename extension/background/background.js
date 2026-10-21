// Background worker: talks to the local LLM on behalf of pages, and wires up menus and shortcuts.
// Loaded after shared/config.js and background/llm.js (see sw.js for Chrome, manifest scripts for Firefox).
(function () {
  'use strict';

  const { ext, getSettings, resolveConnection, listModels, chat, normalizeBaseUrl, createSecretStore, recommendModels, PULL_SUGGESTION, createJobRunner } =
    globalThis.SoroAgent;

  const secrets = createSecretStore();
  // Keys saved in plain text by 2.1.0 are encrypted and removed from chrome.storage on first run.
  const migrated = secrets.migrateFrom(ext.storage.local).catch((err) => console.warn('[SoroAgent] Key migration failed:', err));

  // ---------------------------------------------------------------------------
  // Origin rewriting
  //
  // Ollama answers 403 to requests whose Origin is chrome-extension:// or moz-extension://
  // unless OLLAMA_ORIGINS is configured. We rewrite the Origin of *our own* background
  // requests to the server's own origin, which it always accepts. Web pages are never affected.
  // ---------------------------------------------------------------------------

  const ORIGIN_RULE_ID = 1;
  const extensionBase = ext.runtime.getURL('');
  const manifestPermissions = ext.runtime.getManifest().permissions || [];
  const useWebRequest = manifestPermissions.includes('webRequestBlocking') && Boolean(ext.webRequest);
  let llmOrigin = '';
  let ruleOrigin = '';

  if (useWebRequest) {
    // Firefox: rewrite with blocking webRequest. Registered synchronously so it survives event-page restarts.
    ext.webRequest.onBeforeSendHeaders.addListener(
      (details) => {
        const fromUs = details.tabId === -1 && (details.originUrl || '').startsWith(extensionBase);
        if (!fromUs || !llmOrigin || !details.url.startsWith(llmOrigin + '/')) return {};
        const requestHeaders = details.requestHeaders.filter((h) => h.name.toLowerCase() !== 'origin');
        requestHeaders.push({ name: 'Origin', value: llmOrigin });
        return { requestHeaders };
      },
      { urls: ['http://*/*', 'https://*/*'], types: ['xmlhttprequest'] },
      ['blocking', 'requestHeaders']
    );
  }

  async function ensureOriginRewrite(baseUrl) {
    llmOrigin = new URL(baseUrl).origin;
    if (useWebRequest || !ext.declarativeNetRequest || ruleOrigin === llmOrigin) return;
    try {
      // Chrome: a session rule limited to requests made by this extension outside any tab.
      await ext.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ORIGIN_RULE_ID],
        addRules: [
          {
            id: ORIGIN_RULE_ID,
            priority: 1,
            action: {
              type: 'modifyHeaders',
              requestHeaders: [{ header: 'origin', operation: 'set', value: llmOrigin }],
            },
            condition: {
              urlFilter: `|${llmOrigin}/`,
              tabIds: [-1],
              initiatorDomains: [ext.runtime.id],
              resourceTypes: ['xmlhttprequest', 'other'],
            },
          },
        ],
      });
      ruleOrigin = llmOrigin;
    } catch (err) {
      console.warn('[SoroAgent] Could not install origin rule:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // LLM access
  // ---------------------------------------------------------------------------

  const apiCache = new Map(); // local baseUrl -> 'ollama' | 'openai' (for "auto" detection)

  // overrides: { settings, apiKeys } — lets the settings page test values before saving them.
  // Callers must only pass overrides that came from an extension page (see fromExtensionPage).
  async function getConnection(overrides = {}) {
    await migrated;
    const settings = { ...(await getSettings()), ...(overrides.settings || {}) };
    const apiKeys = { ...(await secrets.getAll()), ...(overrides.apiKeys || {}) };
    const connection = resolveConnection(settings, apiKeys);
    // Only local servers need the Origin rewrite; hosted APIs accept extension requests.
    if (!connection.cloud) await ensureOriginRewrite(normalizeBaseUrl(connection.baseUrl));
    return connection;
  }

  async function getStatus(overrides) {
    const connection = await getConnection(overrides);
    const result = await listModels(connection);
    if (!connection.cloud) apiCache.set(result.baseUrl, result.api);
    const ids = result.models.map((m) => m.id);
    // For local servers, rank what's installed and suggest the best fit for SoroAgent.
    const recommended = connection.cloud ? [] : recommendModels(result.models);
    let model = connection.model;
    if (!model || (!connection.cloud && !ids.includes(model))) model = (recommended[0] && recommended[0].id) || result.suggested;
    // Hosted APIs accept models that aren't listed (aliases, new releases): keep the user's choice.
    if (model && !ids.includes(model)) result.models.unshift({ id: model, size: '', capabilities: [] });
    return {
      ok: true,
      api: result.api,
      baseUrl: result.baseUrl,
      models: result.models,
      model,
      cloud: connection.cloud,
      providerLabel: connection.label,
      recommended,
      // When nothing installed fits well, suggest a download.
      pullSuggestion: !connection.cloud && (!recommended.length || recommended[0].score < 8) ? PULL_SUGGESTION : null,
    };
  }

  async function resolveChat(modelOverride) {
    const connection = await getConnection();
    if (modelOverride) connection.model = modelOverride;
    let api = connection.api === 'auto' ? apiCache.get(normalizeBaseUrl(connection.baseUrl)) : connection.api;
    if (!api || !connection.model) {
      const status = await getStatus();
      api = status.api;
      connection.model = connection.model || status.model;
    }
    return { connection, api };
  }

  function errorPayload(err) {
    return { ok: false, code: err.code || 'error', error: err.message || String(err), hint: err.hint || '' };
  }

  // Long-lived port per request. The content script pings it while waiting, which also keeps
  // Chrome's service worker alive during slow model loads.
  ext.runtime.onConnect.addListener((port) => {
    if (port.name !== 'llm') return;
    const controller = new AbortController();
    let open = true;
    port.onDisconnect.addListener(() => {
      open = false;
      controller.abort();
    });
    const post = (msg) => {
      if (!open) return;
      try {
        port.postMessage(msg);
      } catch {
        open = false;
      }
    };

    port.onMessage.addListener(async (msg) => {
      if (!msg || msg.type !== 'chat') return;
      let sentThinking = false;
      try {
        const { connection, api } = await resolveChat(msg.model);
        const text = await chat({
          connection,
          api,
          messages: msg.messages,
          json: Boolean(msg.json),
          signal: controller.signal,
          onToken: (token) => post({ type: 'token', text: token }),
          onThinking: () => {
            if (!sentThinking) post({ type: 'thinking' });
            sentThinking = true;
          },
        });
        post({ type: 'done', text, model: connection.model });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        post({ type: 'error', ...errorPayload(err) });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Summary jobs: run here, not in the page, so they finish even if the reader leaves.
  // ---------------------------------------------------------------------------

  const jobs = createJobRunner({
    ext,
    errorPayload,
    runChat: async ({ messages, model, signal, onToken, onThinking }) => {
      const { connection, api } = await resolveChat(model);
      return chat({ connection, api, messages, signal, onToken, onThinking });
    },
  });
  jobs.recover();

  ext.runtime.onConnect.addListener((port) => {
    if (port.name !== 'summary') return;
    port.onDisconnect.addListener(() => jobs.detach(port)); // the job keeps running
    port.onMessage.addListener(async (msg) => {
      try {
        if (msg.type === 'start') await jobs.start(msg.job, port);
        else if (msg.type === 'attach' && !jobs.attach(msg.id, port)) port.postMessage({ type: 'gone', id: msg.id });
        else if (msg.type === 'stop') jobs.stop(msg.id);
      } catch (err) {
        port.postMessage({ type: 'error', record: { status: 'error', ...errorPayload(err) } });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Toolbar icon follows the browser theme: white tile in light mode, dark tile in dark mode.
  // ---------------------------------------------------------------------------

  const ICON_SIZES = [16, 32, 48, 128];
  let iconTheme = null;
  async function setThemeIcon(dark) {
    if (iconTheme === dark) return { ok: true };
    iconTheme = dark;
    const path = Object.fromEntries(ICON_SIZES.map((size) => [size, `icons/${dark ? 'dark/' : ''}icon-${size}.png`]));
    try {
      await ext.action.setIcon({ path });
    } catch {
      // Older browsers: keep the manifest icon.
    }
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // One-shot messages from content scripts and extension pages
  // ---------------------------------------------------------------------------

  // True for SoroAgent's own pages (settings, snippets); false for content scripts in web pages.
  function fromExtensionPage(sender) {
    return Boolean(sender && sender.id === ext.runtime.id && (sender.url || '').startsWith(extensionBase));
  }

  function requireExtensionPage(sender) {
    if (!fromExtensionPage(sender)) throw new Error('Not allowed from a web page.');
  }

  // Bumped whenever keys change, so open pages can reconnect without ever seeing a key.
  const announceKeysChanged = () => ext.storage.local.set({ keysVersion: Date.now() });

  const handlers = {
    // Only extension pages may test unsaved values: overrides can redirect a key to another URL.
    'llm:status': (msg, sender) => getStatus(fromExtensionPage(sender) ? msg.overrides || {} : {}),
    'keys:describe': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      return { ok: true, keys: await secrets.describe() };
    },
    'keys:set': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      for (const [provider, key] of Object.entries(msg.keys || {})) {
        if (typeof key === 'string' && key.trim()) await secrets.set(provider, key);
      }
      await announceKeysChanged();
      return { ok: true, keys: await secrets.describe() };
    },
    'keys:remove': async (msg, sender) => {
      requireExtensionPage(sender);
      await migrated;
      await secrets.remove(String(msg.provider || ''));
      await announceKeysChanged();
      return { ok: true, keys: await secrets.describe() };
    },
    'open:snippets': () => ext.tabs.create({ url: ext.runtime.getURL('pages/snippets.html') }),
    'open:options': () => ext.runtime.openOptionsPage(),
    // Pages report the browser's light/dark theme (the worker itself can't see it).
    theme: (msg) => setThemeIcon(Boolean(msg.dark)),
    'open:history': () => ext.tabs.create({ url: ext.runtime.getURL('pages/history.html') }),
    'summary:find': async (msg) => ({ ok: true, record: await jobs.find(msg.url, msg.fingerprint) }),
    'summary:for-url': async (msg) => ({ ok: true, records: await jobs.forUrl(msg.url) }),
    'summary:seen': async (msg) => {
      await jobs.markSeen(msg.ids || []);
      return { ok: true };
    },
    'summary:delete': async (msg, sender) => {
      requireExtensionPage(sender);
      await jobs.remove(msg.ids || []);
      return { ok: true };
    },
  };

  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const handler = msg && handlers[msg.type];
    if (!handler) return false;
    Promise.resolve()
      .then(() => handler(msg, sender))
      .then((result) => sendResponse(result === undefined ? { ok: true } : result))
      .catch((err) => sendResponse(errorPayload(err)));
    return true; // respond asynchronously
  });

  // ---------------------------------------------------------------------------
  // Talking to the assistant in a tab
  // ---------------------------------------------------------------------------

  async function sendToTab(tabId, message) {
    try {
      return await ext.tabs.sendMessage(tabId, message);
    } catch {
      // Tab was open before the extension was installed or reloaded: inject and retry.
      const files = ext.runtime.getManifest().content_scripts[0].js;
      await ext.scripting.executeScript({ target: { tabId }, files });
      return ext.tabs.sendMessage(tabId, message);
    }
  }

  async function sendToActiveTab(message) {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id !== undefined) return sendToTab(tab.id, message);
  }


  const MENU_ITEMS = [
    { id: 'soroagent-save-selection', title: 'Save selection to SoroAgent', contexts: ['selection'], action: 'save' },
    { id: 'soroagent-summarize', title: 'Summarize this page', contexts: ['page'], action: 'summarize' },
  ];

  // Right-click on the toolbar owl.
  const ACTION_MENU_ITEMS = [
    { id: 'soroagent-open-history', title: 'Summary history', open: () => handlers['open:history']() },
    { id: 'soroagent-open-snippets', title: 'Saved snippets', open: () => handlers['open:snippets']() },
    { id: 'soroagent-open-settings', title: 'Settings', open: () => ext.runtime.openOptionsPage() },
  ];

  async function createMenus() {
    await ext.contextMenus.removeAll();
    for (const item of MENU_ITEMS) {
      ext.contextMenus.create({ id: item.id, title: item.title, contexts: item.contexts });
    }
    for (const item of ACTION_MENU_ITEMS) ext.contextMenus.create({ id: item.id, title: item.title, contexts: ['action'] });
  }

  ext.contextMenus.onClicked.addListener((info, tab) => {
    const actionItem = ACTION_MENU_ITEMS.find((m) => m.id === info.menuItemId);
    if (actionItem) {
      actionItem.open();
      return;
    }
    const item = MENU_ITEMS.find((m) => m.id === info.menuItemId);
    if (!item || !tab || tab.id === undefined) return;
    sendToTab(tab.id, { type: 'assistant:run', action: item.action, selectionText: info.selectionText || '' }).catch(
      (err) => console.warn('[SoroAgent] Could not reach the page:', err)
    );
  });

  // Clicking the toolbar owl opens (or closes) the panel on the current page. Pages extensions
  // can't run on (browser pages, web stores) get the settings page instead.
  ext.action.onClicked.addListener((tab) => {
    if (!tab || tab.id === undefined || !/^https?:/.test(tab.url || '')) {
      ext.runtime.openOptionsPage();
      return;
    }
    sendToTab(tab.id, { type: 'assistant:toggle' }).catch(() => ext.runtime.openOptionsPage());
  });

  ext.commands.onCommand.addListener((command) => {
    if (command === 'toggle-assistant') {
      sendToActiveTab({ type: 'assistant:toggle' }).catch((err) => console.warn('[SoroAgent]', err));
    }
  });

  ext.runtime.onInstalled.addListener((details) => {
    createMenus();
    if (details.reason === 'install') ext.runtime.openOptionsPage();
  });
  ext.runtime.onStartup.addListener(createMenus);

  // Keep the Firefox rewrite target current even before the first request after a restart.
  getConnection().catch(() => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.settings || changes.keysVersion)) {
      apiCache.clear();
      getConnection().catch(() => {});
    }
  });
})();
