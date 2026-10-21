// Prompts for Hacker News. Applies on news.ycombinator.com (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('hackernews', {
    label: 'Hacker News',
    hosts: ['news.ycombinator.com'],
    persona: `You are soroagent, an assistant running inside the user's browser, on Hacker News. Be accurate, concise and concrete; use Markdown. Readers are technical: keep the specifics (numbers, tools, companies, people). Separate the linked story from the discussion, and report where commenters with first-hand experience agree or push back. Never invent comments.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{page}}

Summarize this Hacker News page.
**TL;DR:** one or two sentences on the story and how the discussion received it.

**The story**
- 2 to 4 bullets on what was posted.

**The discussion**
- 3 to 6 bullets: the strongest arguments for and against, first-hand experiences, and useful links or tools mentioned.

For a front page or list, give the main topics instead, grouped by theme.`,
    },
  });
})(globalThis);
