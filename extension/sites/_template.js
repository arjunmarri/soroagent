// Template for a new site profile. Copy this file to extension/sites/<your-site>.js (no leading
// underscore), edit it, then run `npm run build`. Files starting with "_" are not loaded.
// See extension/sites/README.md for every field.
(function (root) {
  'use strict';

  root.SoroAgent.registerSite({
    // Unique id; also the key for this site's saved option values.
    id: 'example',
    name: 'Example News',

    // Return true for pages this profile handles.
    matches: (location) => /(^|\.)example\.com$/i.test(location.hostname),

    // Optional: describe the current page. `label` shows in the panel; `context` fills {{context}}.
    pageInfo: (location) => ({
      type: location.pathname.startsWith('/article/') ? 'article' : 'other',
      label: 'Example News',
      context: 'This is an article from Example News, a technology news site.',
    }),

    // Optional: override any action's prompts. Unset fields fall back to shared/prompts.js.
    // Actions: summarize, notes, ask, save, aiCheck, aiCheckItems.
    prompts: {
      summarize: {
        user:
          '{{context}}\n\n{{page}}\n\nSummarize this article for a busy engineer:\n' +
          '**TL;DR:** one sentence.\n**What changed**\n- bullets\n**Why it matters**\n- bullets',
      },
    },

    // Optional: toggles shown in the panel on this site, saved per site.
    // options: [{ id: 'hideSponsored', label: 'Hide sponsored', title: 'Hide sponsored stories', default: true }],
    // applyOptions: (values) => { /* show or hide page elements */ },
  });
})(globalThis);
