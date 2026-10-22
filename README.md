<p align="center"><img src="extension/icons/icon-128.png" width="96" height="96" alt="soroagent owl"></p>

<h1 align="center">soroagent</h1>

<p align="center"><b>Your browser, on steroids.</b><br>
An AI companion for every web page that turns what you read into knowledge you keep.</p>

<p align="center">Chrome · Edge · Brave · Arc · Firefox &nbsp;|&nbsp; macOS · Windows &nbsp;|&nbsp; Local AI (Ollama, LM Studio…) or your own Claude, OpenAI or Gemini key</p>

---

## Why soroagent exists

We read more online than ever, and keep almost none of it.

Browsers were built to *fetch* pages, not to help you *understand* them. Your browsing history is a list of URLs and timestamps: it remembers **where you went**, not **what you learned**. Interesting articles get "saved for later" and never opened again. Tabs pile up. Feeds are designed to keep you scrolling, and ads and pop-ups compete for the attention you came to spend on the content.

**soroagent changes what a browser is for.** It sits quietly beside every page, an owl in the corner, and turns browsing from consumption into learning:

- **Understand faster.** A summary of any page, thread or feed in seconds, and answers to your questions about it.
- **Remember automatically.** Every summary becomes a searchable snippet, so your history becomes a record of ideas, facts and sources rather than links.
- **Think with what you've saved.** soroagent notices when a page relates to notes you saved before and brings them into the conversation, answers questions across everything you've read, and turns it into a brief, a decision, a study guide or a draft.
- **Go deeper on purpose.** When something matters, Research reads the web for you and writes a brief with citations.
- **Take back your attention.** No doom-scrolling, no clutter, a comfortable dark mode on any site, and an honest view of where your time goes.
- **Keep it private.** Run it on a model on your own computer and nothing you read leaves your machine. No accounts, no servers, no analytics.

> **Browsing history, reinvented.** Not *"you visited 214 pages yesterday"* but *"here's what you read, what it said, what you found worth keeping, and where to go deeper."*

## What it does

### Get started in a minute
The first time you open the owl, it says hello (with a joke) and asks you to connect an AI right in the chat: pick Claude, ChatGPT, Gemini, Groq or OpenRouter, paste a key, done. **How do I get a key?** walks you through it step by step without leaving the page, and **I have a local model** sets up a free model on your computer instead. The key box is soroagent's own protected frame, so the website you're on can't see what you type.

### Understand any page
- **Summarize** gives you the page in a clear, scannable format: a one-line TL;DR, then the key points. Ask again while nothing has changed and you get the earlier summary instantly, with **Regenerate** if you want a fresh one.
- **Ask anything** about the page in a chat. Questions like *"do you save my data in the cloud?"* or *"is this open source?"* get a quick *"soroagent or this website?"* first, then an accurate answer about soroagent itself or about the site. You can also tap a suggestion on the opening screen: *What are the key points?*, *Explain it simply*, *What should I double-check?*
- **Tuned for the sites you use.** Built-in prompts for X, Reddit, YouTube, GitHub, Hacker News, Wikipedia, LinkedIn, Amazon, Stack Overflow and major news sites: thread consensus on Reddit, the accepted answer on Stack Overflow, pros and cons from reviews on Amazon.
- **Works while you move on.** Summaries run in the background. Switch tabs or leave the page, and the result is waiting when you come back. The toolbar owl counts what finished while you were away.

### Read feeds without the feed reading you
On **X** and **Reddit**, soroagent reads only what's already on screen: themes, notable posts and overall sentiment, with every **@handle**, **u/user** and **r/community** linked. Then a single small card under the summary offers **Read more** and **Research** together, so the chat stays uncluttered. Each batch needs your yes, is capped in posts, scrolling and time, and after 200 posts (adjustable) it stops offering and suggests a break. Threads get a summary of the post and where the discussion agrees and disagrees. Toggles in the panel give you **Verified only** on X and **Hide ads** on both.

### Remember what you read
- **Snippets, automatically.** Every summary is saved with a title, short summary and tags. Re-summarizing the same page updates it instead of duplicating it. Browse by day, site or topic, search everything, and read in a clean reading view.
- **History of this page.** The clock icon lists everything you've saved from the exact page you're on.
- **Save** keeps a page to read later, with a short excerpt, in its own **Read later** list, marked as read once you open it.
- **Screenshots** (camera icon) of what you see (without soroagent's own button) in their own gallery: view, download, copy, delete.
- **Summary history** keeps every summary run, searchable and filterable, with status.
- **Never lose it.** Everything stays on your computer and carries over to every update. soroagent also keeps a backup file in `Downloads/soroagent/` up to date automatically, and if you ever reinstall, it finds that file and restores everything in one click. You can also export snippets as Markdown or JSON.

### Think with your notes
Saving is only the start. soroagent turns your snippets into a knowledge base you can use, and every answer keeps **what your sources say** (cited as [S1], [S2]…) apart from **the AI's own interpretation**, so you always know which is which.

- **Retrieval when it matters.** Reading about AI agents, and you saved three related articles last month? The panel shows *"📚 3 of your saved notes relate to this page"*. **Use in chat** brings them into the conversation; answers then cite them as [N1], [N2]… alongside the page. Matching happens on your computer: no AI call, nothing sent anywhere.
- **Ask your notes.** A page for questions across everything you've saved, over the past week, month, 3 months or all time:
  - *What have I learned about this topic over the past month?*
  - *Where do my saved sources disagree?*
  - *What evidence supports this argument?*
  - *What should I read next?* (it knows which read-later pages you haven't opened)
  - *What conclusions can I draw from these sources?*
  Answers come in two parts, **From your sources** (every claim cited) and **My interpretation**, with the exact notes used listed underneath and linked.
- **Turn knowledge into an outcome.** One click creates a **Research brief**, a **Technical decision** record (options, evidence, trade-offs, recommendation), a **Study guide** (with practice questions) or a **Draft** article from your notes, cited the same way. Save it to your snippets, copy it, or download it as Markdown.

### Go deeper
**Research** turns a summary into a starting point. First soroagent asks what to focus on, offering specific topics your model picks out of the summary (or type your own). Then it searches the web (DuckDuckGo, Brave Search or Bing, or your own SearXNG), reads the top sources and writes a brief with numbered citations, saved alongside the snippet. Only the search query leaves your machine; the page you were reading doesn't.

### Browse calmer
- **Ads** hides ads, sponsored widgets, cookie walls and sticky video players **without shifting the layout**, so nothing jumps while you read. Remember it per site if you like.
- **Dark mode for any site** (in the panel's **⋯** menu), even ones without their own, with brightness, contrast and sepia sliders. Photos and videos keep their real colours, and it's applied before the page paints, so there's no white flash.
- **Stats** show exactly where your browsing time goes: per day, per website and per page. Time counts only while a tab is in front and you're active (or a video plays), and stays in your browser for 90 days.

### Make it yours
- **Prompts in settings.** Rewrite the system prompt for all websites or for any site, and click **Optimize with AI** to have your own model improve it.
- **Any model.** A local model (Ollama, LM Studio, llama.cpp, Jan, any OpenAI-compatible server) or your own key for Anthropic Claude, OpenAI, Google Gemini, OpenRouter, Groq, Mistral, DeepSeek or xAI. soroagent recommends the best of your installed local models. The green dot in the panel header shows you're connected; hover it to see the model, and switch models from the ⋯ menu.
- **An owl with opinions.** Each time you open it, it greets you with a random one-liner ("Actually, always skip low-quality videos. They fry the brain."). Turn them off in settings if you're all business.
- **An owl that stays out of the way.** It finds a spot that doesn't cover the page's own buttons, follows your mouse with its eyes, and can be dragged anywhere (it flies to the other side and perches there). **Home** brings back the opening screen; drag the panel's edges or corner to resize it (double-click to reset); <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> opens it from the keyboard. Everything follows your browser's light or dark theme.

## Who it's for

- **Students and lifelong learners** who want to keep what they read, not just read it.
- **Researchers, analysts and writers** who need the gist fast, then cited sources to go deeper.
- **Engineers** reading docs, issues, pull requests and Stack Overflow all day.
- **Anyone keeping up** with X, Reddit, Hacker News or the news without losing hours to the feed.

## Private by design

With a local model, page text never leaves your computer. With a cloud API, the text you act on goes only to the provider you chose, billed to your own key. API keys are encrypted with a key that can't be exported, and soroagent sends each one only to its own provider. Snippets, history, stats and settings live in your browser. There are no soroagent accounts, servers, trackers or analytics.

## Download

Current version: **v2.21.0**. The version is in each file name, so you can tell which build you have.

| Browser | Download | Install |
|---|---|---|
| Chrome, Edge, Brave, Arc | [**soroagent-chrome-2.21.0.zip**](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-chrome-2.21.0.zip) | Unzip, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder. |
| Firefox (128+) | [**soroagent-firefox-2.21.0.zip**](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-firefox-2.21.0.zip) | Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose the zip. |

Both work on macOS and Windows. Full steps are below.

## Install

### 1. Choose a model

**No local model? Use a cloud API.** Skip to step 2. After installing, open soroagent's settings, choose **Cloud API**, pick a provider and paste your API key. Each provider has a **Get a key** link. Then click **Test connection** and choose a model.

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

**Other servers:** start the server and use its `/v1` URL in soroagent's settings. For example, LM Studio is `http://127.0.0.1:1234/v1`, the llama.cpp server is `http://127.0.0.1:8080/v1` and Jan is `http://127.0.0.1:1337/v1`.

### 2. Get the extension

**Download a ready-made build** from the [`downloads/`](downloads) folder:

- Chrome, Edge, Brave, Arc: [soroagent-chrome-2.21.0.zip](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-chrome-2.21.0.zip)
- Firefox: [soroagent-firefox-2.21.0.zip](https://github.com/arjunmarri/soroagent/raw/main/downloads/soroagent-firefox-2.21.0.zip)

Unzip the Chrome build into a folder you'll keep: Chrome loads the extension from that folder. Firefox can load the zip directly.

**Or build it yourself.** You need [Node.js](https://nodejs.org) 20 or later. The build has no dependencies and works the same on macOS and Windows.

```bash
npm run build
```

This creates `dist/chrome` and `dist/firefox`. Run `npm run package` to also get zip files in `dist/`.

### 3. Load it in your browser

**Chrome, Edge, Brave, Arc:** open `chrome://extensions` (or `edge://extensions`), turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder (or `dist/chrome` if you built it).

**Firefox (128+):** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose `soroagent-firefox-2.21.0.zip` (or `dist/firefox/manifest.json` if you built it). Temporary add-ons are removed when Firefox restarts. To install it permanently, sign the zip through [addons.mozilla.org](https://addons.mozilla.org/developers/) (it can be unlisted).

On first install the settings page opens and tests the connection to `http://127.0.0.1:11434`.

## Using it

| Where | How |
|---|---|
| Any page | Click the owl button. It places itself where it doesn't cover the page's own buttons (on X it sits clear of Grok and Messages). |
| Keyboard | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> opens or closes the assistant (Option on a Mac). You can change it at `chrome://extensions/shortcuts`. |
| Right-click menu | *Summarize this page*, *Take a screenshot* |
| Toolbar owl | Click to open soroagent on the current page. A number on it means summaries finished while you were away. Right-click for **Summary history**, **Saved snippets**, **Browsing stats**, **Send feedback** and **Settings**. |
| Feedback | **Share feedback** at the bottom of the panel (or in its ⋯ menu) opens a quick feedback page on soroagent.com. Only the version and browser are passed along. |

**Snippets** are built for reading. The list shows each snippet's title, a one-line summary, the site and the time. Group it by **Day**, **Site** or **Topic**, filter by kind (summaries, research), or search everything. **Read later** and **Screenshots** have sections of their own, and things you create in **Ask your notes** are marked *Created*. Click one to read it in a comfortable reading view, with the full summary, its tags, and its research brief and sources if any. **Research this further** is right there. You can also copy, delete, and export to Markdown or JSON from **More**.

**Your data carries over to every update.** Snippets, summary history and settings live in the browser's storage for soroagent. The Chrome build has a fixed extension ID (`jomghmmgdlajfonjihmagbhomimadpcg`), so a newer version loaded from any folder keeps the same storage, and stored data is upgraded automatically when the format changes. soroagent also saves an automatic backup to `Downloads/soroagent/soroagent-backup.json` (a few minutes after changes, at most every 30 minutes; turn it off in **Settings → Backup & restore**). After a fresh install, it looks for that file in the browser's download history and the welcome page offers **Restore my data**: in Chrome it reads the file directly when *Allow access to file URLs* is on for soroagent (on `chrome://extensions`), otherwise a file picker opens in Downloads. Restoring never overwrites anything you already have. To move to another browser or computer, copy the file over and use **Restore from backup**. API keys are never included in backups.

**Playing with the owl.** Its eyes follow your mouse, and it blinks and looks around while it works. Pick it up by dragging: it flaps its wings while you carry it, and when you let go it flies across the page and perches on the opposite side, remembered for that site. Turn on your system's *reduce motion* setting and it moves without animation.

The panel's **⋯** menu can hide the button on the current site or reset a dragged position. In settings you can turn the button off everywhere or pin it to a corner. You can also change the server URL, model, temperature, context window and how much page text to send.

**Picking a local model.** When you connect a local server, soroagent ranks your installed models for its tasks by family, size and speed. Mixture-of-experts models such as `qwen3:30b-a3b` give large-model quality at small-model speed. Settings always shows the best fit, plus a lighter option and a higher-quality one. The panel suggests a better model only once, the first time, and never again once you've picked a model yourself. If nothing installed fits well, it suggests a model to download.

## Site-specific prompts

Every prompt soroagent uses is plain text in [`extension/prompts/`](extension/prompts), so you can fine-tune it without touching the extension code:

- [`default.js`](extension/prompts/default.js): prompts for every site (Summarize, Ask, Research).
- [`x.js`](extension/prompts/x.js) and [`reddit.js`](extension/prompts/reddit.js): prompts for X and Reddit, overriding only what differs. Reddit also has separate prompts for thread pages.
- `youtube.js`, `github.js`, `hackernews.js`, `wikipedia.js`, `linkedin.js`, `amazon.js`, `stackoverflow.js`, `news.js`: prompts for popular sites, matched by their `hosts`.
- `<site>.js`: add your own. A site file only needs the parts it changes.

You don't need to edit files to change how soroagent talks: **Settings → Prompts** lets you rewrite the system prompt for any of these, and optimize it with your model.

Try a prompt against your local model before reloading the extension:

```bash
npm run try-prompt -- --site x --action summarize --show-prompt
```

The **[prompts guide](extension/prompts/README.md)** covers the fine-tuning loop, every action and its reply format, all `{{placeholders}}`, and tips for writing prompts that also work on small models.

## Site profiles

Profiles in [`extension/sites/`](extension/sites) give soroagent site-specific behaviour: page detection, reading posts instead of page text, scrolling to gather more, and panel toggles. Their prompts live in [`extension/prompts/`](extension/prompts). [`x.js`](extension/sites/x.js) is the full X example; [`_template.js`](extension/sites/_template.js) is a starting point. To add your own site, copy the template, set `matches()` and override the prompts you need, then run `npm run build`. New files are picked up automatically. [`extension/sites/README.md`](extension/sites/README.md) documents every field and placeholder.

## How it works

```
 web page ──► content scripts (assistant UI in a closed shadow root, page text extraction)
                 │  long-lived port: chat request ▸ streamed tokens
                 ▼
          background worker ──► http://127.0.0.1:11434  (Ollama /api/chat, or /v1/chat/completions)
```

- All model requests come from the background worker, so page Content Security Policies and mixed-content rules don't block them.
- Three wire formats cover every provider: Ollama's native API, OpenAI chat completions (local servers and most cloud APIs), and Anthropic's Messages API. Claude requests send the system prompt as `system`, skip `temperature` (current Claude models don't accept it) and use `effort: low` for speed. Current models also opt in to server-side refusal fallbacks. If an OpenAI reasoning model rejects a custom temperature, the request is retried without it.
- **API keys** are encrypted at rest with AES-256-GCM. The encryption key is a non-extractable WebCrypto key: the browser can use it, but no script can read its bytes. Both the key and the ciphertext live in the extension's own IndexedDB, which websites, soroagent's page-side scripts and other extensions can't open. Only the background worker decrypts keys, and it sends each key only to its own provider. The settings page never receives a saved key back; it shows only the last four characters. Key changes are announced with a version number, never the key itself. Messages that read or change keys, or test unsaved settings, are accepted only from soroagent's own pages. Keys saved in plain text by 2.1.0 are migrated automatically on first run.
  - *Limits:* this protects against websites, other extensions, and copies or backups of extension storage. It can't stop malware running as your user account, which could control the browser itself. Treat API keys like passwords: give them a spending limit and revoke them if a device is lost.
- **Ollama and 403 errors:** Ollama rejects requests from `chrome-extension://` and `moz-extension://` origins by default. soroagent rewrites the `Origin` header to the server's own origin, which Ollama always accepts. This applies only to the extension's own background requests: Chrome uses a session `declarativeNetRequest` rule and Firefox uses `webRequest`. Requests from web pages are never changed, so you don't need to set `OLLAMA_ORIGINS`.
- Reasoning models (Qwen3, DeepSeek-R1, Gemma 4…) run with thinking turned off for speed, and any `<think>` output is removed. You can turn thinking on in settings.
- **Summaries are background jobs.** The page hands the work to the background worker, which saves progress in the summary history (`summary:<id>` in extension storage, newest 300 kept), streams to whichever page is open, and keeps running if you leave. If the browser itself stops soroagent mid-summary, the entry is marked *interrupted* and you can run it again.
- **Research only reads the public web.** Search results pointing at your computer or local network (localhost, 192.168.x.x, routers, NAS boxes, `.local` names) are never fetched, so nothing private can end up in a prompt.
- **Stats keep addresses without secrets.** Only harmless query parameters (like YouTube's `?v=`) are kept, so tokens in links (password resets, sessions, invites) are never stored or backed up.
- **Links from snippets, history and imported files** are only clickable when they're `http(s)`.
- **Typing in the panel:** the panel lives inside the web page, so a malicious page could in principle observe keystrokes typed into the panel's question box. That's why API keys are entered in soroagent's own frame (first-run setup) or on the settings page, never in the panel's chat box.
- Settings, keys and snippets are stored in `chrome.storage.local` on your machine (one key per snippet, so saves from several tabs can't overwrite each other).

## Development

```
extension/
  manifest.json        base manifest; the build writes per-browser variants
  background/          sw.js (Chrome entry) · background.js (routing, menus, Origin rewrite) · llm.js (Ollama, OpenAI-compatible and Anthropic client) · recommend.js (local model ranking) · secrets.js (encrypted API keys)
  content/             assistant.js (panel and tasks) · launcher.js (button placement, dragging) · extract.js (readable text) · declutter.js (Ads) · dark.js (dark mode) · timetrack.js (Stats) · faq.js (questions about soroagent) · quips.js · styles.js
  prompts/             prompt texts: default.js, site and popular-site prompts, _template.js, samples/ and the fine-tuning guide
  sites/               site profiles: registry.js, x.js, reddit.js, _template.js and a README for contributors
  shared/              config.js (settings) · prompts.js · markdown.js (safe renderer) · snippets.js · knowledge.js (finding related notes) · stats.js · backup.js · ask.js
  pages/               settings, snippets, Ask your notes, summary history, stats and first-run setup pages
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

## License

soroagent is open source under the [MIT License](LICENSE): free to use, change and share.

---

<p align="center"><sub>tech is art. © 2026 <a href="https://soroai.com">soroai.com</a></sub></p>
