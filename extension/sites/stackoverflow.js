// Site profile for Stack Overflow and the Stack Exchange network. A question page is read as the
// question plus its answers, ranked the way a reader would: the accepted answer first, then by
// votes, with code kept intact. Its prompts (accepted-solution mode) are in prompts/stackoverflow.js.
(function (root) {
  'use strict';

  const soroagent = root.soroagent;
  const HOSTS = /(^|\.)(stackoverflow\.com|stackexchange\.com|superuser\.com|serverfault\.com|askubuntu\.com|mathoverflow\.net|stackapps\.com)$/i;
  const MAX_ANSWERS = 5;

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    if (/^\/questions\/\d+/.test(location.pathname)) {
      return {
        type: 'question',
        label: 'Q&A · Accepted-solution mode',
        context: 'This is a question from a Stack Exchange Q&A site, followed by its answers. The accepted answer (if any) is listed first, then answers by votes. Votes show what the community found useful.',
      };
    }
    return { type: 'page', label: 'Stack Exchange', context: '' };
  }

  /**
   * Pure: the question and answers as text for the model.
   * qa: { question: { title, score, tags, body }, answers: [{ score, accepted, author, date, body }] }
   */
  function formatQA({ question, answers }) {
    const ranked = [...(answers || [])].sort((a, b) => Number(b.accepted) - Number(a.accepted) || b.score - a.score);
    const shown = ranked.slice(0, MAX_ANSWERS);
    const head = [
      `QUESTION: ${question.title}`,
      `Score ${question.score}${question.tags && question.tags.length ? ` · tags: ${question.tags.join(', ')}` : ''}`,
      question.body,
    ].join('\n');
    const accepted = ranked.find((a) => a.accepted);
    const summary = `${answers.length} answer${answers.length === 1 ? '' : 's'}${accepted ? ', one accepted by the asker' : ', none accepted'}${answers.length > shown.length ? ` (top ${shown.length} shown)` : ''}.`;
    const blocks = shown.map((a, i) => [
      `ANSWER ${i + 1}${a.accepted ? ' — ACCEPTED' : ''} · score ${a.score}${a.author ? ` · by ${a.author}` : ''}${a.date ? ` · ${a.date}` : ''}`,
      a.body,
    ].join('\n'));
    return [head, summary, ...blocks].join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Reading the page
  // ---------------------------------------------------------------------------

  const votes = (post) => soroagent.numberIn((post.querySelector('.js-vote-count') || {}).getAttribute?.('data-value') ?? (post.querySelector('.js-vote-count') || {}).textContent);
  const bodyOf = (post, max) => soroagent.readableText(post.querySelector('.js-post-body, .s-prose, .post-text'), max);

  function extract(doc, location) {
    if (pageInfo(location).type !== 'question') return null;
    const q = doc.querySelector('#question, .question');
    if (!q) return null;
    const title = ((doc.querySelector('#question-header h1, h1[itemprop="name"]') || {}).textContent || doc.title).trim();
    const question = {
      title,
      score: votes(q),
      tags: [...new Set([...doc.querySelectorAll('#question .post-tag, .post-taglist .post-tag')].map((t) => t.textContent.trim()))].slice(0, 8),
      body: bodyOf(q, 3000),
    };
    const answers = [...doc.querySelectorAll('#answers .answer, .answer[data-answerid]')].map((a) => ({
      score: votes(a),
      accepted: a.classList.contains('accepted-answer') || a.matches('[itemprop="acceptedAnswer"]') || Boolean(a.querySelector('.js-accepted-answer-indicator:not(.d-none)')),
      author: ((a.querySelector('.post-signature:last-child .user-details [itemprop="name"], .post-signature:last-child .user-details a, .user-details a') || {}).textContent || '').trim(),
      date: ((a.querySelector('.relativetime, time') || {}).getAttribute?.('title') || '').slice(0, 10),
      body: bodyOf(a, 2500),
    }));
    return { title, text: formatQA({ question, answers }) };
  }

  soroagent.registerSite({ id: 'stackoverflow', name: 'Stack Overflow', matches: (location) => HOSTS.test(location.hostname), pageInfo, extract });
  soroagent.siteHelpers = { ...(soroagent.siteHelpers || {}), stackoverflow: { pageInfo, formatQA } };
})(globalThis);
