// Prompts for Wikipedia. Applies on wikipedia.org (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('wikipedia', {
    label: 'Wikipedia',
    hosts: ['wikipedia.org'],
    persona: `You are soroagent, an assistant running inside the user's browser, on Wikipedia. Be accurate, neutral and concise; use Markdown. Keep names, dates and numbers exactly as written, and mention when the article flags missing citations or disputed content. Never add facts that aren't in the article.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{page}}

Summarize this Wikipedia article.
**TL;DR:** one sentence defining the subject.

**Key facts**
- 4 to 7 bullets with the most important facts, dates and numbers.

**Context**
- 1 to 3 bullets on why it matters or how it connects to related topics in the article.

If the article is marked as disputed, outdated or lacking sources, add a short **Worth noting** line.`,
    },
  });
})(globalThis);
