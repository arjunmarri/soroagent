// Site profile for GitHub. Issues and pull requests are read as their state, labels and the
// conversation in order; repository pages as the description and README. Its prompts (status and
// next steps) are in prompts/github.js.
(function (root) {
  'use strict';

  const soroagent = root.soroagent;
  const RESERVED = new Set(['settings', 'notifications', 'explore', 'marketplace', 'topics', 'trending', 'collections', 'sponsors', 'orgs', 'login', 'search', 'features', 'pricing', 'about', 'new']);

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    const [owner, repo, section, number] = location.pathname.split('/').filter(Boolean);
    if (owner && repo && !RESERVED.has(owner)) {
      if ((section === 'issues' || section === 'pull') && /^\d+$/.test(number || '')) {
        const kind = section === 'pull' ? 'pull request' : 'issue';
        return { type: section === 'pull' ? 'pull' : 'issue', label: `GitHub · ${kind === 'issue' ? 'Issue' : 'Pull request'} status`, context: `This is a GitHub ${kind} in ${owner}/${repo}: its state, labels, then the conversation in order (the first post is the description).` };
      }
      if (!section) return { type: 'repo', label: `GitHub · ${owner}/${repo}`, context: `This is the GitHub repository ${owner}/${repo}: its description and README.` };
    }
    return { type: 'page', label: 'GitHub', context: '' };
  }

  /** Pure: an issue or PR → text. item: { kind, title, number, state, labels, comments: [{ author, date, body }] } */
  function formatIssue({ kind, title, number, state, labels, comments }) {
    const head = [`${kind === 'pull' ? 'PULL REQUEST' : 'ISSUE'} #${number}: ${title}`, [state && `State: ${state}`, labels && labels.length && `Labels: ${labels.join(', ')}`, `${Math.max(0, comments.length - 1)} replies`].filter(Boolean).join(' · ')].join('\n');
    const posts = comments.map((c, i) => `${i === 0 ? 'DESCRIPTION' : `REPLY ${i}`}${c.author ? ` by ${c.author}` : ''}${c.date ? ` · ${c.date}` : ''}\n${c.body}`);
    return [head, ...posts].join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Reading the page (GitHub's markup changes; anything missing falls back to the page text)
  // ---------------------------------------------------------------------------

  const text = (el) => ((el && el.textContent) || '').replace(/\s+/g, ' ').trim();

  function extract(doc, location) {
    const info = pageInfo(location);
    if (info.type === 'issue' || info.type === 'pull') {
      const title = text(doc.querySelector('[data-testid="issue-title"], bdi.js-issue-title, .js-issue-title, h1 bdi, .markdown-title')) || doc.title.replace(/ · (Issue|Pull Request) #\d+ · .*$/, '').replace(/ by [\w-]+$/, '');
      const state = text(doc.querySelector('[data-testid="header-state"], .State, span.State'));
      const labels = [...new Set([...doc.querySelectorAll('[data-testid="issue-labels"] a, .js-issue-labels a, .IssueLabel')].map(text).filter(Boolean))].slice(0, 10);
      const bodies = [...doc.querySelectorAll('[data-testid="markdown-body"], .timeline-comment .comment-body, .react-issue-body .markdown-body, .js-comment-body')];
      const comments = bodies.map((body) => {
        const box = body.closest('[data-testid="comment-viewer-outer-box"], .timeline-comment, .TimelineItem, article') || body.parentElement;
        return {
          author: text(box && box.querySelector('[data-testid="avatar-link"], a.author, .author')),
          date: ((box && box.querySelector('relative-time')) || { getAttribute: () => '' }).getAttribute('datetime')?.slice(0, 10) || '',
          body: soroagent.readableText(body, 2000),
        };
      }).filter((c) => c.body);
      if (!comments.length) return null;
      return { title, text: formatIssue({ kind: info.type, title, number: location.pathname.split('/').filter(Boolean)[3], state, labels, comments: comments.slice(0, 40) }) };
    }
    if (info.type === 'repo') {
      const readme = doc.querySelector('#readme article, article.markdown-body, [data-testid="readme"] article');
      if (!readme) return null;
      const about = text(doc.querySelector('.BorderGrid p.f4, [itemprop="about"]')) || ((doc.querySelector('meta[name="description"]') || {}).content || '');
      const stars = text(doc.querySelector('#repo-stars-counter-star, .js-social-count'));
      const topics = [...doc.querySelectorAll('a.topic-tag')].map(text).slice(0, 10);
      return { title: doc.title, text: [`REPOSITORY: ${location.pathname.split('/').filter(Boolean).slice(0, 2).join('/')}`, about && `About: ${about}`, stars && `Stars: ${stars}`, topics.length && `Topics: ${topics.join(', ')}`, `README:\n${soroagent.readableText(readme, 9000)}`].filter(Boolean).join('\n') };
    }
    return null;
  }

  soroagent.registerSite({ id: 'github', name: 'GitHub', matches: (location) => location.hostname === 'github.com', pageInfo, extract });
  soroagent.siteHelpers = { ...(soroagent.siteHelpers || {}), github: { pageInfo, formatIssue } };
})(globalThis);
