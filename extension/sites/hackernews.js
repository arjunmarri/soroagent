// Site profile for Hacker News. A story page is read as the story plus its comment tree, with each
// reply's depth kept, so the model can tell top-level opinions from back-and-forth; the front page
// and lists are read as ranked stories. Its prompts (discussion consensus) are in prompts/hackernews.js.
(function (root) {
  'use strict';

  const soroagent = root.soroagent;
  const MAX_COMMENTS = 120;

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    if (location.pathname === '/item') {
      return {
        type: 'thread',
        label: 'Hacker News · Discussion consensus',
        context: 'This is a Hacker News story followed by its comments. "↳" and indentation mark replies; top-level comments are separate viewpoints.',
      };
    }
    return { type: 'list', label: 'Hacker News · Front page', context: 'These are stories from a Hacker News list, in ranked order, with points and comment counts.' };
  }

  /** Pure: story + comments → text. comments: [{ author, depth, text }] (depth 0 = top level). */
  function formatThread({ title, url, points, author, text, comments }) {
    const head = [`STORY: ${title}`, [url && `Link: ${url}`, points && `${points} points`, author && `by ${author}`, `${comments.length} comments`].filter(Boolean).join(' · '), text].filter(Boolean).join('\n');
    const shown = comments.slice(0, MAX_COMMENTS);
    const topLevel = comments.filter((c) => c.depth === 0).length;
    const lines = shown.map((c) => `${'  '.repeat(Math.min(c.depth, 6))}${c.depth ? '↳ ' : '• '}${c.author || 'someone'}: ${c.text}`);
    return [head, `Comments (${topLevel} top-level${comments.length > shown.length ? `, first ${shown.length} shown` : ''}):`, ...lines].join('\n');
  }

  /** Pure: list stories → text. stories: [{ rank, title, site, points, comments }] */
  function formatList(stories) {
    return stories.map((s) => `${s.rank}. ${s.title}${s.site ? ` (${s.site})` : ''} · ${s.points} points · ${s.comments} comments`).join('\n');
  }

  // ---------------------------------------------------------------------------
  // Reading the page
  // ---------------------------------------------------------------------------

  const text = (el) => ((el && el.textContent) || '').trim();

  function extract(doc, location) {
    if (pageInfo(location).type === 'thread') {
      const story = doc.querySelector('.fatitem');
      if (!story) return null;
      const link = story.querySelector('.titleline > a');
      const comments = [...doc.querySelectorAll('tr.athing.comtr')].map((row) => {
        const ind = row.querySelector('td.ind');
        const depth = ind ? Number(ind.getAttribute('indent')) || Math.round((Number((ind.querySelector('img') || {}).width) || 0) / 40) : 0;
        const body = row.querySelector('.commtext');
        return { author: text(row.querySelector('.hnuser')), depth, text: soroagent.readableText(body, 900).replace(/\n+/g, ' ') };
      }).filter((c) => c.text);
      const title = text(link) || doc.title;
      return {
        title,
        text: formatThread({
          title,
          url: link && !/^item\?/.test(link.getAttribute('href') || '') ? link.href : '',
          points: soroagent.numberIn(text(story.querySelector('.score'))),
          author: text(story.querySelector('.hnuser')),
          text: soroagent.readableText(story.querySelector('.toptext'), 2000),
          comments,
        }),
      };
    }
    const stories = [...doc.querySelectorAll('tr.athing.submission, tr.athing')].map((row) => {
      const meta = row.nextElementSibling;
      const commentsLink = meta ? [...meta.querySelectorAll('a')].find((a) => /comment|discuss/.test(a.textContent)) : null;
      return {
        rank: soroagent.numberIn(text(row.querySelector('.rank'))),
        title: text(row.querySelector('.titleline > a')),
        site: text(row.querySelector('.sitestr')),
        points: soroagent.numberIn(text(meta && meta.querySelector('.score'))),
        comments: commentsLink && /\d/.test(commentsLink.textContent) ? soroagent.numberIn(commentsLink.textContent) : 0,
      };
    }).filter((s) => s.title);
    return stories.length ? { title: doc.title, text: formatList(stories) } : null;
  }

  soroagent.registerSite({ id: 'hackernews', name: 'Hacker News', matches: (location) => location.hostname === 'news.ycombinator.com', pageInfo, extract });
  soroagent.siteHelpers = { ...(soroagent.siteHelpers || {}), hackernews: { pageInfo, formatThread, formatList } };
})(globalThis);
