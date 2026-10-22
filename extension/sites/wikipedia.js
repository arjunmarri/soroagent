// Site profile for Wikipedia. An article is read as its infobox facts, lead section and outline,
// then the article text, plus how many statements are flagged "citation needed". Its prompts (key
// facts) are in prompts/wikipedia.js.
(function (root) {
  'use strict';

  const soroagent = root.soroagent;

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  function pageInfo(location) {
    if (/^\/wiki\/[^:]+$/.test(decodeURIComponent(location.pathname)) && !/^\/wiki\/Main_Page$/.test(location.pathname)) {
      return {
        type: 'article',
        label: 'Wikipedia · Key facts',
        context: 'This is a Wikipedia article: the infobox facts, the lead section, the outline, then the article text.',
      };
    }
    return { type: 'page', label: 'Wikipedia', context: '' };
  }

  /** Pure: article → text. a: { title, facts: [[label, value]], lead, sections, citationNeeded, body } */
  function formatArticle({ title, facts, lead, sections, citationNeeded, body }) {
    return [
      `ARTICLE: ${title}`,
      facts.length ? `INFOBOX:\n${facts.map(([k, v]) => `- ${k}: ${v}`).join('\n')}` : '',
      lead ? `LEAD:\n${lead}` : '',
      sections.length ? `OUTLINE: ${sections.join(' · ')}` : '',
      citationNeeded ? `Note: ${citationNeeded} statement${citationNeeded === 1 ? ' is' : 's are'} marked "citation needed".` : '',
      body ? `TEXT:\n${body}` : '',
    ].filter(Boolean).join('\n\n');
  }

  // ---------------------------------------------------------------------------
  // Reading the page
  // ---------------------------------------------------------------------------

  const clean = (el) => ((el && el.textContent) || '').replace(/\[\d+\]|\[citation needed\]/g, '').replace(/\s+/g, ' ').trim();

  function extract(doc, location) {
    if (pageInfo(location).type !== 'article') return null;
    const content = doc.querySelector('#mw-content-text > .mw-parser-output');
    if (!content) return null;
    const title = clean(doc.querySelector('#firstHeading')) || doc.title.replace(/ - Wikipedia$/, '');
    // Infobox rows are "label | value": a header cell and a value, or two plain cells ("Kingdom: | Animalia").
    const facts = [...doc.querySelectorAll('table.infobox tr')].map((row) => {
      const cells = [...row.children].filter((c) => /^T[HD]$/.test(c.tagName));
      return cells.length === 2 ? [clean(cells[0]).replace(/:$/, ''), clean(cells[1])] : null;
    }).filter((f) => f && f[0] && f[1] && f[1].length < 300).slice(0, 25);
    // The lead: paragraphs before the first section heading (articles may be wrapped in <section>s).
    const lead = [];
    for (const node of content.querySelectorAll('p, .mw-heading, h2')) {
      if (node.matches('.mw-heading, h2')) break;
      if (!node.closest('table') && clean(node).length > 40) lead.push(clean(node));
    }
    const sections = [...content.querySelectorAll('.mw-heading2 h2, h2')].map(clean).filter((t, i, all) => t && all.indexOf(t) === i && !/^(see also|references|notes|external links|further reading|bibliography|sources|contents)$/i.test(t));
    const body = soroagent.extractPage ? soroagent.extractPage(doc, { maxChars: 7000 }).text : '';
    return {
      title,
      text: formatArticle({ title, facts, lead: lead.join('\n\n').slice(0, 3000), sections, citationNeeded: doc.querySelectorAll('.Template-Fact, sup.noprint.Inline-Template').length, body }),
    };
  }

  soroagent.registerSite({ id: 'wikipedia', name: 'Wikipedia', matches: (location) => /(^|\.)wikipedia\.org$/i.test(location.hostname), pageInfo, extract });
  soroagent.siteHelpers = { ...(soroagent.siteHelpers || {}), wikipedia: { pageInfo, formatArticle } };
})(globalThis);
