// Site profile for Reddit (new Reddit's <shreddit-*> elements and old.reddit.com). Feeds are read as
// posts, threads as the post plus its comments. Its prompts are in prompts/reddit.js.
(function (root) {
  'use strict';

  const SoroAgent = root.SoroAgent;

  // New Reddit
  const NEW_POST = 'shreddit-post';
  const NEW_AD = 'shreddit-ad-post';
  const NEW_COMMENT = 'shreddit-comment';
  // Old Reddit
  const OLD_POST = '.thing.link';
  const OLD_COMMENT = '.thing.comment';

  const FEED_TYPES = new Set(['home', 'subreddit', 'search', 'user']);

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    const path = (location.pathname || '/').replace(/\/+$/, '') || '/';
    const params = new URLSearchParams(location.search || '');
    const thread = path.match(/^\/r\/([^/]+)\/comments\/([^/]+)/);
    if (thread) {
      return {
        type: 'thread',
        label: `Thread in r/${thread[1]}`,
        context: `This is a Reddit post in r/${thread[1]} (item [1]) followed by its comments; replies are marked with their depth.`,
      };
    }
    if (path === '/search' || /^\/r\/[^/]+\/search$/.test(path)) {
      const query = params.get('q') || '';
      return { type: 'search', query, label: `Search · ${query || 'results'}`, context: `These are Reddit posts from a search for "${query}".` };
    }
    const sub = path.match(/^\/r\/([^/]+)(?:\/(hot|new|top|rising|controversial|best))?$/);
    if (sub) {
      const name = sub[1];
      const special = ['popular', 'all'].includes(name.toLowerCase());
      return {
        type: special ? 'home' : 'subreddit',
        label: `r/${name}${sub[2] ? ` · ${sub[2]}` : ''}`,
        context: special ? `These are posts from Reddit's r/${name} feed.` : `These are posts from the subreddit r/${name}.`,
      };
    }
    const user = path.match(/^\/(?:u|user)\/([^/]+)/);
    if (user) return { type: 'user', label: `u/${user[1]}`, context: `These are posts and comments by the Reddit user u/${user[1]}.` };
    if (path === '/' || /^\/(hot|new|top|best|rising)$/.test(path)) {
      return { type: 'home', label: 'Home feed', context: "These are posts from the user's Reddit home feed." };
    }
    return { type: 'other', label: 'Reddit', context: 'This is content from Reddit.' };
  }

  function compact(n) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
    return String(n);
  }

  const toNumber = (value) => {
    const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?\s*[kKmM]?/);
    if (!match) return 0;
    const n = parseFloat(match[0]);
    return Math.round(/k/i.test(match[0]) ? n * 1e3 : /m/i.test(match[0]) ? n * 1e6 : n);
  };

  /** Numbered list for prompts. Posts and comments are formatted differently. */
  function formatItems(items, { start = 1, maxChars = 700 } = {}) {
    return items
      .map((item, i) => {
        const n = start + i;
        if (item.kind === 'comment') {
          const where = item.depth > 0 ? `reply (depth ${item.depth})` : 'comment';
          const meta = [`u/${item.author || '[deleted]'}`, where, item.score ? `${compact(item.score)} points` : ''].filter(Boolean);
          return `[${n}] ${meta.join(' · ')}\n${(item.text || '').slice(0, maxChars)}`;
        }
        const meta = [
          item.subreddit,
          item.author ? `u/${item.author}` : '',
          item.score ? `${compact(item.score)} points` : '',
          item.comments ? `${compact(item.comments)} comments` : '',
          item.time ? item.time.slice(0, 10) : '',
          item.promoted ? 'AD' : '',
        ].filter(Boolean);
        const body = (item.text || (item.link ? `[link] ${item.link}` : '')).slice(0, maxChars);
        return `[${n}] ${meta.join(' · ')}\nTitle: ${item.title || '(no title)'}${body ? `\n${body}` : ''}`;
      })
      .join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // DOM access
  // ---------------------------------------------------------------------------

  const text = (el) => (el ? el.innerText.replace(/\n{3,}/g, '\n\n').trim() : '');
  const absolute = (href) => (href ? new URL(href, document.location.origin).href : '');

  function parseNewPost(el) {
    const permalink = el.getAttribute('permalink') || '';
    return {
      kind: 'post',
      id: el.getAttribute('id') || permalink || el.getAttribute('post-title') || '',
      url: absolute(permalink),
      title: el.getAttribute('post-title') || text(el.querySelector('[slot="title"]')),
      author: el.getAttribute('author') || '',
      subreddit: el.getAttribute('subreddit-prefixed-name') || '',
      score: toNumber(el.getAttribute('score')),
      comments: toNumber(el.getAttribute('comment-count')),
      time: el.getAttribute('created-timestamp') || '',
      text: text(el.querySelector('[slot="text-body"]')),
      link: el.getAttribute('content-href') && !/reddit\.com/.test(el.getAttribute('content-href')) ? el.getAttribute('content-href') : '',
      promoted: el.matches(NEW_AD) || el.hasAttribute('promoted'),
      el,
    };
  }

  function parseNewComment(el) {
    return {
      kind: 'comment',
      id: el.getAttribute('thingid') || el.getAttribute('id') || '',
      author: el.getAttribute('author') || '',
      score: toNumber(el.getAttribute('score')),
      depth: toNumber(el.getAttribute('depth')),
      text: text(el.querySelector(':scope > [slot="comment"]') || el.querySelector('[slot="comment"]')),
      el,
    };
  }

  function parseOldPost(el) {
    const title = el.querySelector('a.title');
    return {
      kind: 'post',
      id: el.getAttribute('data-fullname') || '',
      url: absolute(el.getAttribute('data-permalink')),
      title: text(title),
      author: el.getAttribute('data-author') || '',
      subreddit: el.getAttribute('data-subreddit-prefixed') || '',
      score: toNumber(el.getAttribute('data-score')),
      comments: toNumber(el.getAttribute('data-comments-count')),
      time: (el.querySelector('time') || { getAttribute: () => '' }).getAttribute('datetime') || '',
      text: text(el.querySelector('.expando .usertext-body .md')),
      link: el.getAttribute('data-url') && !String(el.getAttribute('data-url')).startsWith('/r/') ? el.getAttribute('data-url') : '',
      promoted: el.classList.contains('promoted') || el.hasAttribute('data-promoted'),
      el,
    };
  }

  function parseOldComment(el) {
    const score = el.querySelector(':scope > .entry .score.unvoted');
    let depth = 0;
    for (let node = el.parentElement; node; node = node.parentElement) if (node.matches && node.matches(OLD_COMMENT)) depth++;
    return {
      kind: 'comment',
      id: el.getAttribute('data-fullname') || '',
      author: el.getAttribute('data-author') || '',
      score: toNumber(score && (score.getAttribute('title') || score.textContent)),
      depth,
      text: text(el.querySelector(':scope > .entry .usertext-body .md')),
      el,
    };
  }

  const keep = (item, options) => (!options.hidePromoted || !item.promoted) && Boolean(item.id) && Boolean(item.title || item.text);

  /** Items in the page now: posts on feeds; the post and its comments on a thread. */
  function visibleItems(doc, options = {}) {
    const posts = [...doc.querySelectorAll(`${NEW_POST}, ${NEW_AD}`)].map(parseNewPost);
    const oldPosts = posts.length ? [] : [...doc.querySelectorAll(OLD_POST)].map(parseOldPost);
    const comments = [...doc.querySelectorAll(NEW_COMMENT)].map(parseNewComment);
    const oldComments = comments.length ? [] : [...doc.querySelectorAll(OLD_COMMENT)].map(parseOldComment);
    const seen = new Set();
    return [...posts, ...oldPosts, ...comments, ...oldComments].filter((item) => {
      if (!keep(item, options) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  function focusedItem(doc, location) {
    const items = visibleItems(doc, {});
    if (!items.length) return null;
    if (pageInfo(location).type === 'thread') return items.find((i) => i.kind === 'post') || items[0];
    const middle = window.innerHeight / 2;
    return items.reduce((best, item) => {
      const rect = item.el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      return !best || distance < best.distance ? { item, distance } : best;
    }, null).item;
  }

  // "Hide ads": keep promoted posts hidden as Reddit loads more.
  let filterOptions = {};
  let observer = null;
  let pending = 0;
  function runFilter() {
    pending = 0;
    for (const el of document.querySelectorAll(`${NEW_POST}, ${NEW_AD}, ${OLD_POST}`)) {
      const promoted = el.matches(NEW_AD) || el.hasAttribute('promoted') || el.classList.contains('promoted');
      if (filterOptions.hidePromoted && promoted) el.setAttribute('data-soroagent-filtered', '');
      else el.removeAttribute('data-soroagent-filtered');
    }
  }
  function applyOptions(options) {
    filterOptions = { ...options };
    runFilter();
    if (filterOptions.hidePromoted && !observer) {
      observer = new MutationObserver(() => {
        if (!pending) pending = setTimeout(runFilter, 250);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else if (!filterOptions.hidePromoted && observer) {
      observer.disconnect();
      observer = null;
    }
  }

  SoroAgent.registerSite({
    id: 'reddit',
    name: 'Reddit',
    matches: (location) => /(^|\.)reddit\.com$/i.test(location.hostname),
    options: [{ id: 'hidePromoted', label: 'Hide ads', title: 'Hide promoted posts', default: false }],
    pageInfo,
    applyOptions,
    items: {
      noun: 'posts',
      batchSize: 50,
      isFeed: (info) => FEED_TYPES.has(info.type),
      visible: visibleItems,
      collect: (args) => SoroAgent.collectByScrolling({ ...args, visible: visibleItems }),
      format: formatItems,
      focused: focusedItem,
      element: (item) => (item.el && item.el.isConnected ? item.el : null),
      describe: (item) =>
        item.kind === 'comment'
          ? `u/${item.author}: ${item.text}`
          : `${item.subreddit} · u/${item.author}\n${item.title}${item.text ? `\n\n${item.text}` : ''}${item.url ? `\n${item.url}` : ''}`,
    },
  });

  SoroAgent.siteHelpers = { ...(SoroAgent.siteHelpers || {}), reddit: { pageInfo, formatItems, toNumber } };
})(globalThis);
