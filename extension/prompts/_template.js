// Template for a site's prompts. Copy to extension/prompts/<site id>.js (the same id as the site
// profile in extension/sites/), keep only the actions you want to change, and run `npm run build`.
// Files starting with "_" are not loaded. Guide: extension/prompts/README.md.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('example', {
    // Optional: a different persona for this site.
    // persona: `You are soroagent, a careful reader of engineering news. …`,

    summarize: {
      // Leave out `system` to keep the default one.
      user: `{{context}}

{{page}}

Summarize this article for a busy engineer.
**TL;DR:** one sentence.
**What changed**
- bullets
**Why it matters**
- bullets`,
    },
  });
})(globalThis);
