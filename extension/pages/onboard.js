// First-run setup. After install (its own tab): 1. sync across browsers through Google Drive, or
// skip; 2. pick a cloud AI and paste its key, or use a local model. Embedded (an iframe) in the panel, where it keeps the key away from the web
// page: keystrokes in this frame belong to soroagent, not to the site.
(function () {
  'use strict';

  const S = globalThis.soroagent;
  const { ext, CLOUD_PROVIDERS } = S;
  const $ = (id) => document.getElementById(id);
  const embedded = new URLSearchParams(location.search).has('embed');
  document.body.classList.add(embedded ? 'embed' : 'tab');
  if (embedded) $('hello').hidden = true; // the panel shows its own greeting

  // Providers a beginner is most likely to have (or get for free), in this order.
  const PICKS = [
    { id: 'anthropic', name: 'Claude', note: 'Recommended' },
    { id: 'openai', name: 'ChatGPT', note: 'OpenAI' },
    { id: 'gemini', name: 'Gemini', note: 'Free tier' },
    { id: 'groq', name: 'Groq', note: 'Free tier, fast' },
    { id: 'openrouter', name: 'OpenRouter', note: 'Many models' },
  ].filter((p) => CLOUD_PROVIDERS.some((c) => c.id === p.id));
  const providerOf = (id) => CLOUD_PROVIDERS.find((c) => c.id === id);
  let picked = PICKS[0].id;

  function renderProviders() {
    $('providers').replaceChildren(...PICKS.map((p) => {
      const button = Object.assign(document.createElement('button'), { type: 'button', className: 'provider' });
      button.append(p.name, Object.assign(document.createElement('small'), { textContent: p.note }));
      button.setAttribute('aria-pressed', String(p.id === picked));
      button.addEventListener('click', () => {
        picked = p.id;
        renderProviders();
        renderGuide();
        $('key').focus();
      });
      return button;
    }));
    $('key').placeholder = providerOf(picked).keyPlaceholder || 'Paste your key';
  }

  // Step-by-step help for the picked provider, right here (no trip to Settings).
  function renderGuide() {
    const p = providerOf(picked);
    const name = PICKS.find((x) => x.id === picked).name;
    const guide = $('guide');
    guide.replaceChildren();
    const h = Object.assign(document.createElement('h2'), { textContent: `Getting a ${name} key takes about a minute` });
    const steps = document.createElement('ol');
    const li = (...parts) => {
      const item = document.createElement('li');
      item.append(...parts);
      steps.append(item);
    };
    li('Open ', Object.assign(document.createElement('a'), { href: p.keyUrl, target: '_blank', rel: 'noopener', textContent: new URL(p.keyUrl).hostname }), ' (opens a new tab) and sign in or create a free account.');
    li('Click ', Object.assign(document.createElement('b'), { textContent: picked === 'gemini' ? 'Create API key' : 'Create key' }), ', give it any name (like "soroagent"), and copy it.');
    li('Come back, paste it into the box above, and click ', Object.assign(document.createElement('b'), { textContent: 'Connect' }), '.');
    const extra = {
      anthropic: 'Claude needs a little prepaid credit on your Anthropic account (Billing). A few dollars lasts a long time.',
      openai: 'OpenAI needs billing set up on your account before keys work.',
      gemini: 'Gemini has a free tier, so you can start without a card.',
      groq: 'Groq has a free tier and is very fast.',
      openrouter: 'One OpenRouter key gives you Claude, GPT, Gemini and many more.',
    }[picked];
    const tip = Object.assign(document.createElement('p'), { textContent: `${extra} Tip: set a monthly spending limit in your account for peace of mind.` });
    guide.append(h, steps, tip);
  }

  function status(text, kind = '') {
    $('status').className = `status ${kind}`;
    $('status').textContent = text;
    reportHeight();
  }

  async function finish(res) {
    await S.saveSettings({ onboarded: true, modelTipSeen: true });
    status(`You're all set: connected to ${res.providerLabel || 'your model'}${res.model ? ` (${res.model})` : ''}. ${embedded ? 'Ask me anything about this page!' : 'Click the owl on any website to start.'}`, 'ok');
  }

  $('connect').addEventListener('click', async () => {
    const key = $('key').value.trim();
    if (!key) {
      status('Paste your API key first. Click "How do I get a key?" if you need one.', 'err');
      $('key').focus();
      return;
    }
    $('connect').disabled = true;
    status('Checking your key…');
    try {
      const saved = await ext.runtime.sendMessage({ type: 'keys:set', keys: { [picked]: key } });
      if (!saved || saved.ok === false) throw new Error((saved && saved.error) || 'Could not save the key.');
      await S.saveSettings({ source: 'cloud', cloudProvider: picked });
      const res = await ext.runtime.sendMessage({ type: 'llm:status' });
      if (!res || res.ok === false || !(res.models || []).length) {
        throw Object.assign(new Error((res && res.error) || 'That key didn\'t work.'), { hint: res && res.hint });
      }
      $('key').value = '';
      await finish(res);
    } catch (err) {
      status(`${err.message}${err.hint ? ` ${err.hint}` : ''} Check the key and try again, or click "How do I get a key?".`, 'err');
    } finally {
      $('connect').disabled = false;
    }
  });
  $('key').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('connect').click();
  });

  $('helpBtn').addEventListener('click', () => {
    const open = $('guide').hidden;
    $('guide').hidden = !open;
    $('helpBtn').setAttribute('aria-expanded', String(open));
    reportHeight();
  });
  $('localBtn').addEventListener('click', () => {
    $('cloud').hidden = true;
    $('local').hidden = false;
    status('');
  });
  $('backToCloud').addEventListener('click', () => {
    $('local').hidden = true;
    $('cloud').hidden = false;
    status('');
  });
  $('checkLocal').addEventListener('click', async () => {
    $('checkLocal').disabled = true;
    status('Looking for your local model…');
    try {
      await S.saveSettings({ source: 'local' });
      const res = await ext.runtime.sendMessage({ type: 'llm:status' });
      if (!res || res.ok === false) throw Object.assign(new Error((res && res.error) || 'No local model found.'), { hint: res && res.hint });
      if (!(res.models || []).length) throw new Error('Ollama is running, but it has no models yet. Run: ollama pull llama3.2');
      await finish({ ...res, providerLabel: 'your local model' });
    } catch (err) {
      status(`${err.message}${err.hint ? ` ${err.hint}` : ''}`, 'err');
    } finally {
      $('checkLocal').disabled = false;
    }
  });

  // Step 1 (the install tab only): offer sync. Skipping is one click; Settings can turn it on later.
  function showAiStep(numbered = true) {
    $('sync').hidden = true;
    $('cloud').hidden = false;
    $('keyNote').hidden = false;
    $('aiStep').hidden = !numbered;
    $('key').focus();
  }
  async function offerSync() {
    $('sync').hidden = false;
    $('cloud').hidden = true;
    $('keyNote').hidden = true;
    const st = await ext.runtime.sendMessage({ type: 'sync:status' }).catch(() => null);
    if (st && st.on) showAiStep(false); // already syncing (set up in Settings first)
  }
  $('syncSkip').addEventListener('click', () => {
    status('');
    showAiStep();
  });
  $('syncConnect').addEventListener('click', async () => {
    const passphrase = $('syncPass').value;
    if (passphrase.length < 8) {
      status('Choose a passphrase of at least 8 characters (or the one you already use in your other browser).', 'err');
      $('syncPass').focus();
      return;
    }
    $('syncConnect').disabled = true;
    status('Sign in to Google in the window that opened…');
    try {
      await S.createGoogleAuth(ext).getToken(false, true);
      status('Connecting…');
      const res = await ext.runtime.sendMessage({ type: 'sync:connect', provider: 'gdrive', passphrase });
      if (!res || res.ok === false) throw new Error((res && res.error) || 'Could not connect.');
      $('syncPass').value = '';
      const others = Object.keys(res.devices || {}).length - 1;
      status(others > 0 ? `Sync is on. Your library from ${others === 1 ? 'your other browser' : `${others} other browsers`} is here now${res.received ? ` (${res.received} notes)` : ''}.` : 'Sync is on. Install soroagent in your other browsers and connect with the same passphrase.', 'ok');
      showAiStep();
    } catch (err) {
      status(/did not approve|cancel|closed/i.test(err.message) ? 'Google sign-in was closed. Try again, or skip for now.' : err.message, 'err');
    } finally {
      $('syncConnect').disabled = false;
    }
  });
  $('syncPass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('syncConnect').click();
  });

  // In the panel, tell the frame's parent (soroagent's content script) how tall to be.
  function reportHeight() {
    if (!embedded) return;
    requestAnimationFrame(() => parent.postMessage({ soroagentOnboardHeight: Math.ceil(document.documentElement.scrollHeight) }, '*'));
  }
  new ResizeObserver(reportHeight).observe(document.body);

  renderProviders();
  renderGuide();
  if (!embedded) offerSync();
  reportHeight();
})();
