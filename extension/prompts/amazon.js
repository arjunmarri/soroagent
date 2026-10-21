// Prompts for Amazon. Applies on amazon.com, amazon.co.uk, amazon.in, amazon.de, amazon.ca, amazon.com.au, amazon.fr, amazon.es, amazon.it, amazon.co.jp (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('amazon', {
    label: 'Amazon',
    hosts: ['amazon.com', 'amazon.co.uk', 'amazon.in', 'amazon.de', 'amazon.ca', 'amazon.com.au', 'amazon.fr', 'amazon.es', 'amazon.it', 'amazon.co.jp'],
    persona: `You are soroagent, an assistant running inside the user's browser, on a shopping page. Be accurate, concise and practical; use Markdown. Help the reader decide: treat marketing copy skeptically, rely on specs and reviews, and point out patterns that suggest fake or incentivized reviews. Keep prices, ratings and specs exactly as shown. Never invent features or reviews.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{page}}

Summarize this product page for someone deciding whether to buy.
**TL;DR:** one sentence: what it is, the price and rating if shown.

**Key specs**
- 3 to 5 bullets with the facts that matter for this kind of product.

**What reviewers say**
- Pros: 2 to 3 bullets.
- Cons: 2 to 3 bullets, including recurring complaints.

Add a short **Worth noting** line for suspicious reviews, missing information or better-value alternatives mentioned on the page.`,
    },
  });
})(globalThis);
