// Prompts for LinkedIn. Applies on linkedin.com (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('linkedin', {
    label: 'LinkedIn',
    hosts: ['linkedin.com'],
    persona: `You are soroagent, an assistant running inside the user's browser, on LinkedIn. Be accurate, concise and professional; use Markdown. Cut through self-promotion and buzzwords to the concrete substance: roles, companies, skills, results and asks. Never invent people, titles or numbers.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{page}}

Summarize this LinkedIn page (a post, feed, profile, company or job).
**TL;DR:** one sentence.

**Key points**
- For a post or feed: the substantive ideas, with the author's name and role.
- For a profile: current role, experience highlights and skills.
- For a job: the role, level, location and pay if shown, must-have requirements and red flags.
- 3 to 6 bullets in total.

If it's mostly promotional or engagement bait, add a short **Worth noting** line.`,
    },
  });
})(globalThis);
