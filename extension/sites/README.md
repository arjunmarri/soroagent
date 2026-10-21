# Site profiles

SoroAgent works on any page, but a **site profile** makes it smarter on a specific website. A profile can:

- use **specialized prompts** for each action (summarize, ask, save, AI Slop check). The prompt texts live in [`../prompts/`](../prompts), one file per site, so they're easy to fine-tune;
- read the page as **items** (posts, comments, results) rather than plain text;
- **gather more content by scrolling** (for example, 100 posts from a search page);
- add **toggles** to the panel (for example, "Verified only" on X).

[`x.js`](x.js) is the complete example used for X (formerly Twitter). [`_template.js`](_template.js) is a minimal starting point.

## Add a profile for your site

1. Copy `_template.js` to `extension/sites/<your-site>.js`. Files whose names start with `_` are skipped.
2. Set `id`, `name` and `matches(location)`.
3. Add the site's prompts in [`../prompts/<id>.js`](../prompts) (copy `prompts/_template.js`). See the [prompts guide](../prompts/README.md).
4. Run `npm run build` and reload the extension. The build adds every `sites/*.js` file to the content scripts automatically, so you don't need to edit the manifest.
5. Run `npm test`. The tests check that every profile registers correctly.

## Profile fields

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Unique id. Also the key for the site's saved option values. |
| `name` | | Shown in the panel. |
| `matches(location)` | yes | Return `true` for pages this profile handles. Receives `window.location`. |
| `pageInfo(location)` | | Returns `{ type, label, context, … }`. `label` appears in the panel; `context` fills `{{context}}` in prompts. |
| `prompts` | | Rarely needed. Put prompts in [`../prompts/<id>.js`](../prompts) instead. Inline prompts here override that file. |
| `options` | | `[{ id, label, title, default }]` — toggles shown in the panel on this site. |
| `applyOptions(values)` | | Called with `{ optionId: boolean }` when the page loads and whenever a toggle changes. |
| `items` | | Treat the page as a list of items. See below. |

### Prompts

Actions, placeholders, reply formats and the fine-tuning workflow are documented in the [prompts guide](../prompts/README.md).

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
