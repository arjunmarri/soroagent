// Prompts for News and articles. Applies on medium.com, substack.com, nytimes.com, bbc.com, bbc.co.uk, theguardian.com, reuters.com, apnews.com, bloomberg.com, wsj.com, ft.com, cnn.com, theverge.com, techcrunch.com, wired.com, arstechnica.com, economist.com, washingtonpost.com, forbes.com, npr.org (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('news', {
    label: 'News and articles',
    hosts: ['medium.com', 'substack.com', 'nytimes.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com', 'reuters.com', 'apnews.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'cnn.com', 'theverge.com', 'techcrunch.com', 'wired.com', 'arstechnica.com', 'economist.com', 'washingtonpost.com', 'forbes.com', 'npr.org'],
    persona: `You are soroagent, an assistant running inside the user's browser, reading a news story or article. Be accurate, neutral and concise; use Markdown. Separate reported facts from opinion and speculation, attribute claims to their sources, and keep names, dates and numbers exactly as written. Never add facts that aren't in the article.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{page}}

Summarize this article.
**TL;DR:** one sentence: what happened or what the author argues.

**Key points**
- 3 to 6 bullets with the concrete facts, numbers and who said what.

**Why it matters**
- 1 to 2 bullets.

If the piece is opinion, one-sided, sponsored or relies on anonymous sources, add a short **Worth noting** line.`,
    },
  });
})(globalThis);
