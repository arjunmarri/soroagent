# Site-specific prompts

Every prompt SoroAgent sends to the model lives in this folder as plain text. To change how SoroAgent summarizes, answers, saves or runs the AI Slop check, edit the prompt here; you don't need to touch any extension code.

| File | Used on |
|---|---|
| [`default.js`](default.js) | Every website, and for any action a site file leaves out |
| [`x.js`](x.js) | X (formerly Twitter) |
| [`_template.js`](_template.js) | Starting point for a new site (not loaded) |
| [`samples/`](samples) | Example inputs for trying prompts (not shipped in the extension) |

## How prompts are chosen

For each action, SoroAgent combines up to three layers. A later layer wins, separately for `system` and `user`:

1. `prompts/default.js`
2. `prompts/<site id>.js`, for example `x.js`, when the page matches the site profile with that id in [`../sites/`](../sites)
3. `prompts` written directly inside a site profile (rarely needed)

So a site file only needs the parts it changes. For example, `x.js` replaces the AI Slop check's `system` prompt but keeps the default `user` prompt and its JSON format.

## Fine-tuning loop

1. **Try the current prompt** on a sample, outside the browser, using your local model:

   ```bash
   npm run try-prompt -- --site x --action summarize --show-prompt
   ```

2. **Edit** the prompt in `default.js` or the site's file.
3. **Run it again** and compare. Use `--model` to check a small and a large model; prompts that work on both are the most robust:

   ```bash
   npm run try-prompt -- --site x --action summarize --model llama3.2:3b
   npm run try-prompt -- --site x --action summarize --model qwen3:30b-a3b
   ```

4. **Try real content.** Copy text from a page into a file and pass `--input my-page.txt`. For item sites like X, use the numbered format in `samples/x-posts.txt`.
5. Run `npm test` (checks every prompt file), then `npm run build`, and reload the extension to use it in the browser.

`try-prompt` options:

| Option | Default | |
|---|---|---|
| `--site` | `default` | Prompt set to use (`default`, `x`, …) |
| `--action` | `summarize` | `summarize`, `notes`, `ask`, `save`, `aiCheck`, `aiCheckItems` |
| `--input` | a file in `samples/` | Text to run the prompt on |
| `--question` | | The question, for `ask` |
| `--context` | an X search description for `x` | Fills `{{context}}` |
| `--model` | best installed model | Any model on your server |
| `--url` | `http://127.0.0.1:11434` | Your local server (or set `SOROAGENT_URL`) |
| `--show-prompt` | off | Print the exact messages sent to the model |

For JSON actions, `try-prompt` also prints what SoroAgent read from the reply. If that line says it couldn't read the reply, the extension would show an error too.

## Actions

| Action | When it runs | Reply format |
|---|---|---|
| `summarize` | **Summarize** | Markdown |
| `notes` | Long content is summarized in parts: notes per part, then `summarize` merges them | Markdown |
| `ask` | A question typed in the panel. `system` carries the page; `user` is the question | Markdown |
| `save` | **Save**: title, summary and tags | JSON `{ "title", "summary", "tags" }` |
| `aiCheck` | **AI Slop check** on a whole page | JSON `{ "ai_probability", "confidence", "signals" }` |
| `aiCheckItems` | **AI Slop check** on sites with posts: one score per post | JSON `{ "scores": { "<n>": { "ai", "why" } } }` |

You can reword anything, but **keep the JSON field names** for JSON actions so SoroAgent can read the reply. Every prompt set can also define a `persona` string, which fills `{{persona}}`.

## Placeholders

| Placeholder | Value |
|---|---|
| `{{persona}}` | The `persona` of the prompt set (falls back to `default.js`) |
| `{{title}}`, `{{url}}` | Page title and URL |
| `{{content}}` | The text being worked on: page text, numbered posts or the selection |
| `{{page}}` | Title, URL and content wrapped in `<page>` tags, plus a truncation note if needed |
| `{{count}}` | Number of posts in `{{content}}` (item sites) |
| `{{context}}` | What the page is, from the site profile, for example `These are top posts from X search results for the query "local llm".` |
| `{{note}}` | The truncation note on its own, or empty |
| `{{question}}` | The user's question (`ask` only) |

## Add prompts for a new site

1. Make sure there's a site profile for it in [`../sites/`](../sites) (see that folder's README). Its `id` connects the two.
2. Copy `_template.js` to `<id>.js` and change the id in `definePrompts('<id>', …)`.
3. Keep only the actions you want to change.
4. Run `npm test`, then `npm run build`. New files in this folder are picked up automatically.

## Tips for good prompts

- **Say what the content is.** "Posts from an X search for …" or "a GitHub issue thread" helps more than general instructions. `{{context}}` is the place for it.
- **Ask for structure** (headings, bullets), and say what to leave out.
- **List concrete signals** for judgments such as the AI Slop check. One example phrase per signal works better than adjectives.
- **Write for small models too.** Short, direct sentences and explicit formats help 3–8B models most.
- **Change one thing at a time** and compare runs on the same input.
