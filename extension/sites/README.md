# Site profiles

SoroAgent works on any page, but a **site profile** makes it smarter on a specific website. A profile can:

- use **specialized prompts** for each action (summarize, ask, save, AI Slop check);
- read the page as **items** (posts, comments, results) rather than plain text;
- **gather more content by scrolling** (for example, 100 posts from a search page);
- add **toggles** to the panel (for example, "Verified only" on X).

[`x.js`](x.js) is the complete example used for X (formerly Twitter). [`_template.js`](_template.js) is a minimal starting point.

## Add a profile for your site

1. Copy `_template.js` to `extension/sites/<your-site>.js`. Files whose names start with `_` are skipped.
2. Set `id`, `name` and `matches(location)`.
3. Override only the prompts you need.
4. Run `npm run build` and reload the extension. The build adds every `sites/*.js` file to the content scripts automatically, so you don't need to edit the manifest.
5. Run `npm test`. The tests check that every profile registers correctly.

## Profile fields

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Unique id. Also the key for the site's saved option values. |
| `name` | | Shown in the panel. |
| `matches(location)` | yes | Return `true` for pages this profile handles. Receives `window.location`. |
| `pageInfo(location)` | | Returns `{ type, label, context, … }`. `label` appears in the panel; `context` fills `{{context}}` in prompts. |
| `prompts` | | `{ <action>: { system?, user? } }`. Any field you leave out uses the default from [`shared/prompts.js`](../shared/prompts.js). |
| `options` | | `[{ id, label, title, default }]` — toggles shown in the panel on this site. |
| `applyOptions(values)` | | Called with `{ optionId: boolean }` when the page loads and whenever a toggle changes. |
| `items` | | Treat the page as a list of items. See below. |

### Actions and placeholders

| Action | Used for | Default reply format |
|---|---|---|
| `summarize` | **Summarize** | Markdown |
| `notes` | Summarizing long content in parts; the notes are merged by `summarize` | Markdown |
| `ask` | Questions typed in the panel (`system` is used; the question is `{{question}}`) | Markdown |
| `save` | Titles, summaries and tags for **Save** | JSON `{ title, summary, tags }` |
| `aiCheck` | **AI Slop check** on a whole page | JSON `{ ai_probability, confidence, signals }` |
| `aiCheckItems` | **AI Slop check** per item, on sites with `items` | JSON `{ scores: { "<n>": { ai, why } } }` |

If you change a JSON prompt, keep the same reply shape so SoroAgent can read it.

| Placeholder | Value |
|---|---|
| `{{persona}}` | The default assistant persona |
| `{{title}}`, `{{url}}` | Page title and URL |
| `{{content}}` | The text being worked on: page text, formatted items or the selection |
| `{{page}}` | Title, URL and content wrapped in `<page>` tags |
| `{{count}}` | Number of items in `{{content}}` |
| `{{context}}` | `pageInfo().context` (plus batch details when gathering more) |
| `{{note}}` | A truncation note, or empty |
| `{{question}}` | The user's question (`ask` only) |

### Items

For sites made of posts or results, add an `items` object:

| Field | What it does |
|---|---|
| `noun` | What an item is called in the UI, for example `'posts'`. |
| `visible(document, optionValues)` | Returns the items currently in the page: `[{ id, text, … }]`, where `id` is stable. |
| `format(items, { start })` | Turns items into numbered text (`[1] …`) for prompts. |
| `isFeed(pageInfo)` | Return `true` when **Summarize** should gather `batchSize` items by scrolling. |
| `batchSize` | How many items to gather per batch (X uses 100). |
| `collect({ target, skip, options, signal, onProgress, fromY })` | Scrolls and gathers items. Resolves with `{ items, endY, exhausted }`. |
| `focused(document, location)` | The item **Save** stores when nothing is selected. |
| `describe(item)` | Plain-text version of an item for saving. |
| `badgeAnchor(item)` | Element after which the AI Slop check badge is placed. |

## Tips

- Keep selectors in one place at the top of the file; sites change their markup.
- Read the page; don't change it, except through `applyOptions`.
- Make prompts specific to the site's content. Generic instructions are already in the defaults.
