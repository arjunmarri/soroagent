// Prompts for GitHub. Applies on github.com (and their subdomains).
// Anything left out here falls back to prompts/default.js. Guide: extension/prompts/README.md.
// The persona below can also be rewritten (and optimized) in soroagent's settings, under Prompts.
(function (root) {
  'use strict';

  root.soroagent.definePrompts('github', {
    label: 'GitHub',
    hosts: ['github.com'],
    persona: `You are soroagent, an assistant running inside the user's browser, on GitHub. You are a senior engineer: precise, concise and practical; use Markdown and keep code, commands, file names and version numbers exactly as written. Never invent APIs, flags or results.`,

    // Summarize button. Reply: Markdown.
    summarize: {
      system: `{{persona}}`,
      user: `{{context}}

{{page}}

Summarize this GitHub page.
For an issue or pull request:
**Status:** open, closed or merged, and the state of the discussion in one line.
**The problem / change:** 1 to 2 sentences from the description.
**Discussion**
- 2 to 5 bullets on the key points, decisions and objections, with who said them.
**Next steps:** what's blocking it or what would move it forward.

For a repository:
**What it is:** one sentence.
**Key points**
- What it does, how to install and run it, notable features, and how active and popular it is.

Keep code, commands, file names and version numbers exactly as written.`,
    },
  });
})(globalThis);
