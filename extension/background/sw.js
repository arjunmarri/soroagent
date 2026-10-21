// Chrome service worker entry point. Firefox loads the same files via "background.scripts".
importScripts('../shared/config.js', '../shared/markdown.js', 'llm.js', 'recommend.js', 'secrets.js', 'jobs.js', 'background.js');
