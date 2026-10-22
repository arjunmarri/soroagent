// Site profile for YouTube. A video page is read as its title, channel, description, chapters
// (from the timestamps in the description) and the comments that have loaded, with their likes.
// Its prompts (chapters) are in prompts/youtube.js.
(function (root) {
  'use strict';

  const soroagent = root.soroagent;
  const MAX_COMMENTS = 40;

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/')) {
      return {
        type: 'video',
        label: 'YouTube · Chapters & comments',
        context: 'This is a YouTube video page: title, channel, description, chapters and the comments that have loaded. The video itself (what is said in it) is not included unless the description covers it.',
      };
    }
    return { type: 'page', label: 'YouTube', context: '' };
  }

  /** Pure: chapters from a description: lines like "0:00 Intro" or "1:02:03 - Q&A". */
  function parseChapters(description) {
    const chapters = [];
    for (const line of String(description || '').split('\n')) {
      const m = line.trim().match(/^(?:[-•*]\s*)?((?:\d{1,2}:)?\d{1,2}:\d{2})\s*[-–—:|)]?\s*(.{2,100})$/);
      if (m) chapters.push({ time: m[1], title: m[2].trim() });
    }
    // A real chapter list starts at 0:00 and has at least three entries.
    return chapters.length >= 3 && /^0?0:00$/.test(chapters[0].time) ? chapters : [];
  }

  /**
   * Pure: the description without the panels YouTube shows after it (music, transcript, channel
   * links), with the "Video details" numbers pulled out: { description, views, date }.
   */
  function cleanDescription(raw) {
    const text = String(raw || '');
    const details = text.match(/Video details\s*Date\s*([^\n]*?)\s*Views\s*([\d,.]+)/i);
    const description = text
      .split(/\n(?:Music|Transcript|Show transcript|Chapters|People mentioned|Explore the podcast|Video details|Featured places|Games)\n/)[0]
      .replace(/\s*(…more|\.\.\.more|Show less)\s*(more)?\s*$/i, '')
      .trim()
      .slice(0, 4000);
    return { description, views: details ? `${details[2]} views` : '', date: details ? details[1].trim() : '' };
  }

  /** Pure: video → text. video: { title, channel, views, date, description, chapters, comments: [{ author, likes, text }] } */
  function formatVideo({ title, channel, views, date, description, chapters, comments }) {
    return [
      `VIDEO: ${title}`,
      [channel && `Channel: ${channel}`, views, date].filter(Boolean).join(' · '),
      chapters.length ? `CHAPTERS:\n${chapters.map((c) => `${c.time} ${c.title}`).join('\n')}` : 'CHAPTERS: none listed',
      description ? `DESCRIPTION:\n${description}` : '',
      comments.length ? `TOP COMMENTS (${comments.length} loaded):\n${comments.map((c) => `• ${c.author || 'someone'}${c.likes ? ` (${c.likes} likes)` : ''}: ${c.text}`).join('\n')}` : 'COMMENTS: none loaded yet (scroll down to load them).',
    ].filter(Boolean).join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Reading the page
  // ---------------------------------------------------------------------------

  const text = (el) => ((el && el.textContent) || '').replace(/[ \t]+/g, ' ').trim();

  function extract(doc, location) {
    if (pageInfo(location).type !== 'video') return null;
    const title = text(doc.querySelector('h1.ytd-watch-metadata, ytd-watch-metadata h1, #title h1')) || ((doc.querySelector('meta[name="title"]') || {}).content || doc.title.replace(/ - YouTube$/, ''));
    // The first non-empty description inside the video's own details (YouTube renders several).
    const candidates = ['ytd-watch-metadata #description-inline-expander', 'ytd-watch-metadata #description', 'ytd-watch-metadata ytd-text-inline-expander'];
    const descText = candidates.map((s) => soroagent.squashText((doc.querySelector(s) || {}).textContent || '')).find((t) => t.length > 20);
    const raw = descText || ((doc.querySelector('meta[name="description"]') || {}).content || '');
    const { description, views, date } = cleanDescription(raw);
    const comments = [...doc.querySelectorAll('ytd-comment-thread-renderer')].slice(0, MAX_COMMENTS).map((c) => ({
      author: text(c.querySelector('#author-text')),
      likes: text(c.querySelector('#vote-count-middle')),
      text: text(c.querySelector('#content-text')).slice(0, 500),
    })).filter((c) => c.text);
    return {
      title,
      text: formatVideo({
        title,
        channel: text(doc.querySelector('ytd-watch-metadata #channel-name a, #owner #channel-name a, ytd-channel-name a')),
        views,
        date,
        description,
        chapters: parseChapters(description),
        comments,
      }),
    };
  }

  soroagent.registerSite({ id: 'youtube', name: 'YouTube', matches: (location) => /(^|\.)youtube\.com$/i.test(location.hostname), pageInfo, extract });
  soroagent.siteHelpers = { ...(soroagent.siteHelpers || {}), youtube: { pageInfo, parseChapters, cleanDescription, formatVideo } };
})(globalThis);
