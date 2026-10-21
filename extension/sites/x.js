// Site profile for X (formerly Twitter): reads posts instead of page text, gathers search results
// by scrolling, adds "Verified only" / "Hide ads" filters, and uses X-specific prompts.
// A worked example for extension/sites/README.md.
(function (root) {
  'use strict';

  const SoroAgent = root.SoroAgent;

  const TWEET = 'article[data-testid="tweet"]';
  // First path segments that are app pages, not usernames.
  const RESERVED = new Set([
    'home', 'explore', 'search', 'notifications', 'messages', 'settings', 'i', 'compose', 'login', 'signup',
    'logout', 'tos', 'privacy', 'jobs', 'communities', 'premium_sign_up', 'account', 'hashtag', 'lists',
  ]);
  const FEED_TYPES = new Set(['search', 'timeline', 'profile', 'bookmarks', 'list']);

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  /** What kind of X page this is, with a label for the panel and context for the prompts. */
  function pageInfo(location) {
    const path = location.pathname || '/';
    const params = new URLSearchParams(location.search || '');
    if (path.startsWith('/search')) {
      const query = params.get('q') || '';
      const tab = params.get('f') === 'live' ? 'Latest' : params.get('f') === 'user' ? 'People' : 'Top';
      return {
        type: 'search',
        query,
        label: `Search · ${query || 'results'}`,
        context: `These are ${tab.toLowerCase()} posts from X search results for the query "${query}".`,
      };
    }
    const status = path.match(/^\/([^/]+)\/status\/(\d+)/);
    if (status) {
      return {
        type: 'thread',
        label: `Post by @${status[1]}`,
        context: `This is a post by @${status[1]} on X (item [1]) followed by replies in the conversation.`,
      };
    }
    if (path === '/' || path === '/home') {
      return { type: 'timeline', label: 'Home timeline', context: "These are posts from the user's X home timeline." };
    }
    if (path.startsWith('/i/bookmarks')) return { type: 'bookmarks', label: 'Bookmarks', context: "These are posts the user bookmarked on X." };
    if (/^\/i\/lists\/\d+/.test(path)) return { type: 'list', label: 'List', context: 'These are posts from an X list.' };
    const profile = path.match(/^\/([A-Za-z0-9_]{1,15})(?:\/(with_replies|media|highlights|articles))?\/?$/);
    if (profile && !RESERVED.has(profile[1].toLowerCase())) {
      return { type: 'profile', label: `@${profile[1]}`, context: `These are posts from the X profile @${profile[1]}.` };
    }
    return { type: 'other', label: 'X', context: 'These are posts from X.' };
  }

  /** Parses counts from X's aria-labels ("1,234 Likes. Like") or compact text ("1.2K"). */
  function parseCount(label) {
    const match = String(label || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([KkMmBb])?/);
    if (!match) return 0;
    const scale = { k: 1e3, m: 1e6, b: 1e9 }[(match[2] || '').toLowerCase()] || 1;
    return Math.round(Number(match[1]) * scale);
  }

  function compact(n) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
    return String(n);
  }

  /** Numbered post list for prompts: "[n] @handle (Name, verified) · date · engagement\ntext". */
  function formatPosts(posts, { start = 1, maxChars = 600 } = {}) {
    return posts
      .map((p, i) => {
        const about = [p.name, p.verified ? 'verified' : ''].filter(Boolean).join(', ');
        const who = `${p.handle || '@unknown'}${about ? ` (${about})` : ''}`;
        const meta = [
          p.time ? p.time.slice(0, 10) : '',
          p.likes ? `${compact(p.likes)} likes` : '',
          p.reposts ? `${compact(p.reposts)} reposts` : '',
          p.replies ? `${compact(p.replies)} replies` : '',
          p.promoted ? 'AD' : '',
        ].filter(Boolean);
        const text = (p.text || (p.hasMedia ? '[media only]' : '')).slice(0, maxChars);
        return `[${start + i}] ${who}${meta.length ? ` · ${meta.join(' · ')}` : ''}\n${text}`;
      })
      .join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // DOM access
  // ---------------------------------------------------------------------------

  function parsePost(article) {
    const userBlock = article.querySelector('[data-testid="User-Name"]');
    const parts = userBlock ? userBlock.innerText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    const handle = parts.find((s) => /^@\w+$/.test(s)) || '';
    const name = parts[0] && parts[0] !== handle ? parts[0] : '';
    const time = article.querySelector('time');
    const link = time && time.closest('a[href*="/status/"]');
    const url = link ? new URL(link.getAttribute('href'), document.location.origin).href : '';
    const id = (url.match(/\/status\/(\d+)/) || [])[1] || `${handle}:${(article.innerText || '').slice(0, 60)}`;
    const metric = (...ids) => {
      for (const testId of ids) {
        const el = article.querySelector(`[data-testid="${testId}"]`);
        if (el) return parseCount(el.getAttribute('aria-label') || el.innerText);
      }
      return 0;
    };
    const textEl = article.querySelector('[data-testid="tweetText"]');
    return {
      id,
      url,
      name,
      handle,
      verified: Boolean(userBlock && userBlock.querySelector('[data-testid="icon-verified"], svg[aria-label*="erified"]')),
      promoted:
        Boolean(article.querySelector('[data-testid="placementTracking"]')) ||
        [...article.querySelectorAll('span')]
          .slice(0, 60)
          .some((s) => /^(Ad|Promoted)$/.test(s.textContent.trim()) && !s.closest('[data-testid="tweetText"]')),
      time: time ? time.getAttribute('datetime') || '' : '',
      text: textEl ? textEl.innerText.trim() : '',
      hasMedia: Boolean(article.querySelector('[data-testid="tweetPhoto"], [data-testid="videoPlayer"], [data-testid="card.wrapper"]')),
      replies: metric('reply'),
      reposts: metric('retweet', 'unretweet'),
      likes: metric('like', 'unlike'),
      el: article,
    };
  }

  function passes(post, options) {
    if (options.verifiedOnly && !post.verified) return false;
    if (options.hidePromoted && post.promoted) return false;
    return Boolean(post.text || post.hasMedia);
  }

  /** Posts currently in the page (X only keeps the ones near the viewport in the DOM). */
  function visiblePosts(doc, options = {}) {
    const seen = new Set();
    const posts = [];
    for (const article of doc.querySelectorAll(TWEET)) {
      if (article.parentElement && article.parentElement.closest(TWEET)) continue; // quoted post inside another
      const post = parsePost(article);
      if (seen.has(post.id) || !passes(post, options)) continue;
      seen.add(post.id);
      posts.push(post);
    }
    return posts;
  }

  const sleep = (ms, signal) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(Object.assign(new Error('Stopped.'), { name: 'AbortError' }));
        }, { once: true });
      }
    });

  /**
   * Scrolls the page to gather up to `target` posts not in `skip`. Starts from `fromY` when given.
   * Resolves with { items, endY, exhausted }. The caller restores the scroll position.
   */
  async function collect({ target = 100, skip = new Set(), options = {}, signal, onProgress, fromY }) {
    const found = new Map();
    if (typeof fromY === 'number') {
      window.scrollTo(0, fromY);
      await sleep(900, signal);
    }
    let idleRounds = 0;
    while (found.size < target && idleRounds < 6) {
      if (signal && signal.aborted) throw Object.assign(new Error('Stopped.'), { name: 'AbortError' });
      const before = found.size;
      for (const post of visiblePosts(document, options)) {
        if (!skip.has(post.id) && !found.has(post.id)) found.set(post.id, { ...post, el: null });
      }
      if (onProgress) onProgress(Math.min(found.size, target), target);
      if (found.size >= target) break;
      const height = document.documentElement.scrollHeight;
      window.scrollBy(0, Math.max(400, window.innerHeight * 0.85));
      // Give X time to fetch and render the next page of results.
      for (let waited = 0; waited < 2400; waited += 300) {
        await sleep(300, signal);
        if (document.documentElement.scrollHeight !== height) break;
      }
      idleRounds = found.size === before ? idleRounds + 1 : 0;
    }
    return { items: [...found.values()].slice(0, target), endY: window.scrollY, exhausted: idleRounds >= 6 };
  }

  /** The post to save when nothing is selected: the main post of a thread, else the one in view. */
  function focusedPost(doc, location) {
    const posts = visiblePosts(doc, {});
    if (!posts.length) return null;
    if (pageInfo(location).type === 'thread') return posts[0];
    const middle = window.innerHeight / 2;
    let best = posts[0];
    let bestDistance = Infinity;
    for (const post of posts) {
      const rect = post.el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      if (distance < bestDistance) {
        best = post;
        bestDistance = distance;
      }
    }
    return best;
  }

  // Keeps "Verified only" / "Hide ads" applied as X loads more posts.
  let filterOptions = {};
  let observer = null;
  let pending = 0;

  function runFilter() {
    pending = 0;
    for (const article of document.querySelectorAll(TWEET)) {
      const post = parsePost(article);
      const hide = (filterOptions.verifiedOnly && !post.verified) || (filterOptions.hidePromoted && post.promoted);
      if (hide) article.setAttribute('data-soroagent-filtered', '');
      else article.removeAttribute('data-soroagent-filtered');
    }
  }

  function applyOptions(options) {
    filterOptions = { ...options };
    runFilter();
    const active = filterOptions.verifiedOnly || filterOptions.hidePromoted;
    if (active && !observer) {
      observer = new MutationObserver(() => {
        if (!pending) pending = setTimeout(runFilter, 250);
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else if (!active && observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Prompts: override the defaults in shared/prompts.js for X.
  // ---------------------------------------------------------------------------

  const POSTS_INTRO =
    'Posts are numbered [n] and show the author handle, whether the account is verified, the date and engagement. ' +
    'Engagement shows reach, not truth. Cite accounts as @handle.';

  const prompts = {
    summarize: {
      system: `{{persona}}\nYou analyze posts from X (formerly Twitter). ${POSTS_INTRO}`,
      user:
        '{{context}}\n\n<posts count="{{count}}">\n{{content}}\n</posts>\n\n' +
        'Summarize these {{count}} posts.\nFormat:\n' +
        '**TL;DR:** one or two sentences on what people are saying.\n\n' +
        '**Main themes**\n- 3 to 6 bullets; name representative accounts as @handle.\n\n' +
        '**Notable posts**\n- 2 to 4 posts worth reading: @handle — short paraphrase (why it stands out).\n\n' +
        '**Sentiment:** one line (for example: mostly positive, divided, critical).\n\n' +
        'Only use what is in the posts. Say so if many posts are ads, repetitive or low-effort.',
    },
    notes: {
      system: `{{persona}}\nYou take notes on posts from X. ${POSTS_INTRO}`,
      user:
        '{{context}}\n\n<posts>\n{{content}}\n</posts>\n\n' +
        'Write compact notes (max 12 bullets): main themes, notable posts (keep @handles), numbers, and sentiment. ' +
        'These notes will be merged with notes on other posts into one summary.',
    },
    ask: {
      system:
        `{{persona}}\nAnswer questions about these posts from X. ${POSTS_INTRO} ` +
        "If the posts don't contain the answer, say so.\n\n{{context}}\n\n<posts>\n{{content}}\n</posts>",
    },
    save: {
      user:
        'A post from X.\nURL: {{url}}\n\n<post>\n{{content}}\n</post>\n\n' +
        'Return JSON: {"title": "short title naming the author and the topic, max 80 chars", ' +
        '"summary": "1-2 sentences with the key information", "tags": ["1 to 4 short lowercase topic tags"]}',
    },
    aiCheckItems: {
      system:
        'You review posts from X and estimate whether each was written by AI or by a person. Judge style, not opinion. ' +
        'AI signals on X: thread-bait hooks ("Here\'s why 🧵", "7 lessons I learned"), LinkedIn-style one-line paragraphs, ' +
        'emoji bullets, generic motivational or hype lines, engagement farming ("Agree? Repost ♻️"), and generic reply-guy ' +
        'praise ("Great insight!", "This is so true"). Human signals: specific details, personal voice, slang, typos, ' +
        'jokes and replies that engage with a specific point. Short posts are hard to judge: keep them near 50 unless ' +
        'the signals are clear. Reply with JSON only.',
    },
  };

  SoroAgent.registerSite({
    id: 'x',
    name: 'X',
    matches: (location) => /(^|\.)(x|twitter)\.com$/i.test(location.hostname),
    options: [
      { id: 'verifiedOnly', label: 'Verified only', title: 'Show and analyze only posts from verified accounts', default: false },
      { id: 'hidePromoted', label: 'Hide ads', title: 'Hide promoted posts', default: false },
    ],
    pageInfo,
    prompts,
    applyOptions,
    items: {
      noun: 'posts',
      batchSize: 100,
      /** Summarize gathers a batch by scrolling on feeds; threads use what's loaded. */
      isFeed: (info) => FEED_TYPES.has(info.type),
      visible: visiblePosts,
      collect,
      format: formatPosts,
      focused: focusedPost,
      element: (post) => (post.el && post.el.isConnected ? post.el : null),
      // Where to show an AI-check badge inside a post.
      badgeAnchor: (post) => post.el && post.el.querySelector('[data-testid="tweetText"]'),
      describe: (post) => `${post.handle}${post.name ? ` (${post.name})` : ''}: ${post.text}${post.url ? `\n${post.url}` : ''}`,
    },
  });

  SoroAgent.siteHelpers = { ...(SoroAgent.siteHelpers || {}), x: { pageInfo, parseCount, compact, formatPosts } };
})(globalThis);
