// Prompt engine and response parsers. The prompt texts live in extension/prompts/:
// default.js for every site, plus one file per site (e.g. x.js) that overrides what it needs.
// See extension/prompts/README.md for actions, placeholders and how to fine-tune them.
//
// Placeholders available to every template:
//   {{persona}}      the persona from the prompt set
//   {{title}}        page title            {{url}}       page URL
//   {{content}}      the text being worked on (page text, posts, selection…)
//   {{page}}         title + URL + content wrapped in <page> tags, with a truncation note
//   {{count}}        number of items (posts) in {{content}}, when the site provides items
//   {{context}}      extra context from the site profile (e.g. "Search results for …")
//   {{note}}         truncation note ("" when nothing was cut)
//   {{question}}     the user's question (ask action only)
// Pure functions: unit tested without a browser.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});

  const ACTIONS = Object.freeze(['summarize', 'notes', 'ask', 'save']);
  const PLACEHOLDERS = Object.freeze(['persona', 'title', 'url', 'content', 'page', 'count', 'context', 'note', 'question']);
  const promptSets = {}; // set id ("default", "x", …) -> { persona?, <action>: { system?, user? } }

  /** Registers the prompts for a site id; called by the files in extension/prompts/. */
  function definePrompts(id, prompts) {
    if (!id || typeof prompts !== 'object') throw new Error('definePrompts(id, prompts) needs an id and an object.');
    for (const key of Object.keys(prompts)) {
      if (key !== 'persona' && !ACTIONS.includes(key)) throw new Error(`Prompts "${id}": unknown action "${key}". Known: ${ACTIONS.join(', ')}.`);
    }
    promptSets[id] = prompts;
  }

  // Later sets override earlier ones, per action and per field (system/user).
  function mergeSets(...sets) {
    const merged = {};
    for (const set of sets) {
      if (!set) continue;
      for (const [key, value] of Object.entries(set)) {
        merged[key] = key === 'persona' ? value : { ...(merged[key] || {}), ...value };
      }
    }
    return merged;
  }

  /** Prompts for a site: defaults, then extension/prompts/<siteId>.js, then inline profile overrides. */
  function promptsFor(siteId, inline) {
    return mergeSets(promptSets.default, siteId && siteId !== 'default' ? promptSets[siteId] : null, inline);
  }

  function render(template, vars) {
    return String(template || '').replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] === undefined ? '' : String(vars[name])));
  }

  /** Placeholder values for a page { title, url, text, truncated }, plus any extras. */
  function pageVars(page, extra = {}) {
    const note = page.truncated ? '[Content was truncated to fit the model context.]' : '';
    const content = page.text || '';
    return {
      title: page.title || '(untitled)',
      url: page.url || '',
      content,
      note,
      page: `Title: ${page.title || '(untitled)'}\nURL: ${page.url || ''}\n\n<page>\n${content}\n</page>${note ? `\n${note}` : ''}`,
      count: '',
      context: '',
      question: '',
      ...extra,
    };
  }

  /**
   * Builds chat messages for an action. `prompts` is a full set from promptsFor(), or a partial
   * set of overrides; anything missing comes from the default prompts.
   */
  function buildMessages(action, vars, prompts) {
    if (!ACTIONS.includes(action)) throw new Error(`Unknown prompt action: ${action}`);
    const set = mergeSets(promptSets.default, prompts);
    const template = set[action] || {};
    const allVars = { persona: set.persona || '', ...vars };
    const messages = [];
    const system = render(template.system, allVars).trim();
    if (system) messages.push({ role: 'system', content: system });
    if (template.user) messages.push({ role: 'user', content: render(template.user, allVars).trim() });
    return messages;
  }

  // Pulls the first JSON object out of a model reply, tolerating code fences and chatter.
  function parseJsonLoose(text) {
    const cleaned = SoroAgent.stripThinking(text || '')
      .replace(/```(?:json)?/gi, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // fall through to scanning for a balanced object
    }
    const start = cleaned.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (ch === '\\') i++;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  function parseSnippetMeta(text, fallbackTitle) {
    const json = parseJsonLoose(text) || {};
    const clean = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    const tags = Array.isArray(json.tags) ? json.tags : [];
    return {
      title: clean(json.title, 120) || clean(fallbackTitle, 120) || 'Untitled snippet',
      summary: clean(json.summary, 600),
      tags: [...new Set(tags.map((t) => clean(t, 30).toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 4),
    };
  }

  Object.assign(SoroAgent, {
    PROMPT_ACTIONS: ACTIONS,
    PROMPT_PLACEHOLDERS: PLACEHOLDERS,
    definePrompts,
    promptsFor,
    renderTemplate: render,
    pageVars,
    buildMessages,
    parseJsonLoose,
    parseSnippetMeta,
  });
})(globalThis);
