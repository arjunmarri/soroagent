# SoroAgent

An AI assistant on every web page. SoroAgent is a browser extension for Chrome (and Chromium browsers such as Edge and Brave) and Firefox, on macOS and Windows. It runs on either:

- **A local model on your computer:** [Ollama](https://ollama.com), LM Studio, llama.cpp, Jan, or any OpenAI-compatible server. This is private and free.
- **A cloud API with your own key:** Anthropic (Claude), OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, or any OpenAI-compatible API. Use this if you don't have a local model.

Click the owl 🦉 on any page to get started. SoroAgent's mascot is a mint owl perched on a branch, always there and quietly watching. Its button and toolbar icon switch between light and dark with your browser's theme. Then:

- **Summarize** the page. Ask again while nothing has changed and you get the earlier summary instantly, with a **Regenerate** link.
- **Work in parallel.** Summaries run in the background, so you can move on to another page or tab while SoroAgent works. When you come back, the result is waiting in the panel. The toolbar owl shows how many summaries finished while you were away.
- **Summary history.** Every summary is kept. Browse them by day in **Summary history**, search them, filter by site or status, and copy, re-open or save any of them as a snippet.
- **Ask** follow-up questions about the page in a chat.
- **Save** your selection (or the page) to a local library. The model writes a title, a summary and tags.

**Feeds on X and Reddit**, detected automatically:

- **Summarize reads only what's loaded.** No surprise scrolling. You get themes, notable posts (by @handle or title) and the overall sentiment.
- **Then it asks if you'd like to read more.** If you say yes, it scrolls to load up to 50 more posts, summarizes only the new ones, and puts you back where you were.
- **No doom-scrolling.** Every batch needs your yes, and each one is capped in posts, scroll steps and time. After 200 posts on a page (adjustable in settings), SoroAgent stops offering and suggests a break.
- **Threads.** On a Reddit thread or an X post, it summarizes the discussion: the post, what people say, and where they agree.
- **Panel toggles:** **Verified only** on X and **Hide ads** on both, for higher-signal feeds and summaries.
- **Site-specific prompts** for X and Reddit. Any website can get its own: see [Site profiles](#site-profiles).

With a local model, page text never leaves your computer. With a cloud API, the text you act on goes only to the provider you choose, and is billed to your key. There are no SoroAgent accounts, servers or analytics.

## Download

Current version: **v2.7.0**. The version is in each file name, so you can tell which build you have.

| Browser | Download | Install |
|---|---|---|
| Chrome, Edge, Brave, Arc | [**soroagent-chrome-2.7.0.zip**](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-chrome-2.7.0.zip) | Unzip, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder. |
| Firefox (128+) | [**soroagent-firefox-2.7.0.zip**](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-firefox-2.7.0.zip) | Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose the zip. |

Both work on macOS and Windows. Full steps are below.

## Install

### 1. Choose a model

**No local model? Use a cloud API.** Skip to step 2. After installing, open SoroAgent's settings, choose **Cloud API**, pick a provider and paste your API key. Each provider has a **Get a key** link. Then click **Test connection** and choose a model.

| Provider | Where to get a key | Notes |
|---|---|---|
| Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Native Messages API; recommends Claude Opus 5.5 |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | |
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini's OpenAI-compatible endpoint |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | One key for hundreds of models |
| Groq, Mistral, DeepSeek, xAI | each provider's console | |
| Other | — | Any OpenAI-compatible base URL (Together, Fireworks, Azure-style proxies…) |

**Or run a local model:**

**Ollama (recommended):** install it from [ollama.com](https://ollama.com) (macOS or Windows), then pull a model:

```bash
ollama pull llama3.2
```

Small models (3–8B) are fast. Larger ones (14B and up) summarize and filter noticeably better.

**Other servers:** start the server and use its `/v1` URL in SoroAgent's settings. For example, LM Studio is `http://127.0.0.1:1234/v1`, the llama.cpp server is `http://127.0.0.1:8080/v1` and Jan is `http://127.0.0.1:1337/v1`.

### 2. Get the extension

**Download a ready-made build** from the [`downloads/`](downloads) folder:

- Chrome, Edge, Brave, Arc: [soroagent-chrome-2.7.0.zip](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-chrome-2.7.0.zip)
- Firefox: [soroagent-firefox-2.7.0.zip](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-firefox-2.7.0.zip)

Unzip the Chrome build into a folder you'll keep: Chrome loads the extension from that folder. Firefox can load the zip directly.

**Or build it yourself.** You need [Node.js](https://nodejs.org) 20 or later. The build has no dependencies and works the same on macOS and Windows.

```bash
npm run build
```

This creates `dist/chrome` and `dist/firefox`. Run `npm run package` to also get zip files in `dist/`.

### 3. Load it in your browser

**Chrome, Edge, Brave, Arc:** open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder (or `dist/chrome` if you built it).

**Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose `soroagent-firefox-2.7.0.zip` (or `dist/firefox/manifest.json` if you built it). Temporary add-ons are removed when Firefox restarts. To install it permanently, sign the zip through [addons.mozilla.org](https://addons.mozilla.org/developers/) (it can be unlisted).

On first install the settings page opens and tests the connection to `http://127.0.0.1:11434`.

## Using it

| Where | How |
|---|---|
| Any page | Click the owl button. It places itself where it doesn't cover the page's own buttons (on X it sits clear of Grok and Messages). |
| Keyboard | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> opens or closes the assistant (Option on a Mac). You can change it at `chrome://extensions/shortcuts`. |
| Right-click menu | *Save selection to SoroAgent*, *Summarize this page* |
| Toolbar owl | Click to open SoroAgent on the current page. A number on it means summaries finished while you were away. Right-click for **Summary history**, **Saved snippets** and **Settings**. |

Saved snippets open in a **timeline**: grouped by day (Today, Yesterday, then dates) with the time of each save and a month index for jumping back in history. Click a site or a tag to filter, or search across everything. Switch to the **List** view any time; SoroAgent remembers your choice. You can also copy, delete, and export to JSON or Markdown (and import JSON).

**Playing with the owl.** Its eyes follow your mouse, and it blinks and looks around while it works. Pick it up by dragging: it flaps its wings while you carry it, and when you let go it flies across the page and perches on the opposite side, remembered for that site. Turn on your system's *reduce motion* setting and it moves without animation.

The panel's **⋯** menu can hide the button on the current site or reset a dragged position. In settings you can turn the button off everywhere or pin it to a corner. You can also change the server URL, model, temperature, context window and how much page text to send.

**Picking a local model.** When you connect a local server, SoroAgent ranks your installed models for its tasks by family, size and speed. Mixture-of-experts models such as `qwen3:30b-a3b` give large-model quality at small-model speed. Settings always shows the best fit, plus a lighter option and a higher-quality one. The panel suggests a better model only once, the first time, and never again once you've picked a model yourself. If nothing installed fits well, it suggests a model to download.

## Site-specific prompts

Every prompt SoroAgent uses is plain text in [`extension/prompts/`](extension/prompts), so you can fine-tune it without touching the extension code:

- [`default.js`](extension/prompts/default.js): prompts for every site (Summarize, Ask, Save).
- [`x.js`](extension/prompts/x.js) and [`reddit.js`](extension/prompts/reddit.js): prompts for X and Reddit, overriding only what differs. Reddit also has separate prompts for thread pages.
- `<site>.js`: add your own. A site file only needs the parts it changes.

Try a prompt against your local model before reloading the extension:

```bash
npm run try-prompt -- --site x --action summarize --show-prompt
```

The **[prompts guide](extension/prompts/README.md)** covers the fine-tuning loop, every action and its reply format, all `{{placeholders}}`, and tips for writing prompts that also work on small models.

## Site profiles

Profiles in [`extension/sites/`](extension/sites) give SoroAgent site-specific behaviour: page detection, reading posts instead of page text, scrolling to gather more, and panel toggles. Their prompts live in [`extension/prompts/`](extension/prompts). [`x.js`](extension/sites/x.js) is the full X example; [`_template.js`](extension/sites/_template.js) is a starting point. To add your own site, copy the template, set `matches()` and override the prompts you need, then run `npm run build`. New files are picked up automatically. [`extension/sites/README.md`](extension/sites/README.md) documents every field and placeholder.

## How it works

```
 web page ──► content scripts (assistant UI in a closed shadow root, page text extraction)
                 │  long-lived port: chat request ▸ streamed tokens
                 ▼
          background worker ──► http://127.0.0.1:11434  (Ollama /api/chat, or /v1/chat/completions)
```

- All model requests come from the background worker, so page Content Security Policies and mixed-content rules don't block them.
- Three wire formats cover every provider: Ollama's native API, OpenAI chat completions (local servers and most cloud APIs), and Anthropic's Messages API. Claude requests send the system prompt as `system`, skip `temperature` (current Claude models don't accept it) and use `effort: low` for speed. Current models also opt in to server-side refusal fallbacks. If an OpenAI reasoning model rejects a custom temperature, the request is retried without it.
- **API keys** are encrypted at rest with AES-256-GCM. The encryption key is a non-extractable WebCrypto key: the browser can use it, but no script can read its bytes. Both the key and the ciphertext live in the extension's own IndexedDB, which websites, SoroAgent's page-side scripts and other extensions can't open. Only the background worker decrypts keys, and it sends each key only to its own provider. The settings page never receives a saved key back; it shows only the last four characters. Key changes are announced with a version number, never the key itself. Messages that read or change keys, or test unsaved settings, are accepted only from SoroAgent's own pages. Keys saved in plain text by 2.1.0 are migrated automatically on first run.
  - *Limits:* this protects against websites, other extensions, and copies or backups of extension storage. It can't stop malware running as your user account, which could control the browser itself. Treat API keys like passwords: give them a spending limit and revoke them if a device is lost.
- **Ollama and 403 errors:** Ollama rejects requests from `chrome-extension://` and `moz-extension://` origins by default. SoroAgent rewrites the `Origin` header to the server's own origin, which Ollama always accepts. This applies only to the extension's own background requests: Chrome uses a session `declarativeNetRequest` rule and Firefox uses `webRequest`. Requests from web pages are never changed, so you don't need to set `OLLAMA_ORIGINS`.
- Reasoning models (Qwen3, DeepSeek-R1, Gemma 4…) run with thinking turned off for speed, and any `<think>` output is removed. You can turn thinking on in settings.
- **Summaries are background jobs.** The page hands the work to the background worker, which saves progress in the summary history (`summary:<id>` in extension storage, newest 300 kept), streams to whichever page is open, and keeps running if you leave. If the browser itself stops SoroAgent mid-summary, the entry is marked *interrupted* and you can run it again.
- Settings, keys and snippets are stored in `chrome.storage.local` on your machine (one key per snippet, so saves from several tabs can't overwrite each other).

## Development

```
extension/
  manifest.json        base manifest; the build writes per-browser variants
  background/          sw.js (Chrome entry) · background.js (routing, menus, Origin rewrite) · llm.js (Ollama, OpenAI-compatible and Anthropic client) · recommend.js (local model ranking) · secrets.js (encrypted API keys)
  content/             assistant.js (panel and tasks) · launcher.js (button placement, dragging) · extract.js (readable text) · styles.js
  prompts/             prompt texts: default.js, x.js, _template.js, samples/ and the fine-tuning guide
  sites/               site profiles: registry.js, x.js, _template.js and a README for contributors
  shared/              config.js (settings) · prompts.js · markdown.js (safe renderer) · snippets.js
  pages/               settings and snippets pages
  icons/               generated by scripts/make-icons.mjs
scripts/build.mjs      copies extension/ to dist/<browser>/ with the right manifest; --zip packs it
test/                  node:test unit tests (LLM client, prompts and parsers, Markdown, manifest wiring)
```

```bash
npm test          # unit tests
npm run build     # dist/chrome and dist/firefox
npm run package   # build plus zips
npm run release -- patch   # bump the version (patch | minor | major) and publish versioned zips + README links
npm run downloads # rebuild downloads/ for the current version without bumping
npm run icons     # regenerate the PNG icons
npm run try-prompt -- --site x --action summarize   # run a prompt against your local model
```

After editing, run `npm run build` and click **Reload** on the extension card (or reload the temporary add-on in Firefox).

## Troubleshooting

- **"Can't reach http://127.0.0.1:11434"**: Ollama isn't running. Open the app (macOS menu bar or Windows tray), or run `ollama serve`.
- **No models**: run `ollama pull llama3.2` (or any chat model).
- **Still getting 403 Forbidden** (for example from a proxy in front of Ollama): allow extension origins, then quit and restart Ollama.
  - macOS: `launchctl setenv OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"`
  - Windows: `setx OLLAMA_ORIGINS "chrome-extension://*,moz-extension://*"`
- **The button doesn't appear**: browser pages (`chrome://`, the extension stores, PDFs) can't run extensions. On a normal site, reload the tab after installing.
- **Cloud API errors:** *rejected the API key* means a wrong or expired key, or no billing set up. *Rate limiting* means wait a minute or check your account limits. *Model not found* means pick another model in settings.
- **Slow first answer**: the model is loading into memory. Later requests are much faster.

## Earlier versions

SoroAgent was called **SoroTrack** until version 2.2 and was developed in [arjunmarri/sorotracker](https://github.com/arjunmarri/sorotracker). SoroTrack 1.x, an 𝕏-history archive with a React dashboard, Express server, Firestore and Gemini, lives on there.
