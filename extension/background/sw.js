// Chrome service worker entry point. Firefox loads the same files via "background.scripts".
importScripts('../shared/config.js', '../shared/markdown.js', '../shared/prompts.js', '../shared/snippets.js', '../shared/backup.js', 'llm.js', 'recommend.js', 'secrets.js', 'research.js', 'jobs.js', 'background.js');
