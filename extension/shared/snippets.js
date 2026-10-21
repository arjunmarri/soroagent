// Snippets live in extension storage, one key per snippet ("snippet:<id>") so that
// saves from several tabs at once never overwrite each other.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});
  const PREFIX = 'snippet:';

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function addSnippet(fields) {
    const snippet = {
      id: newId(),
      createdAt: new Date().toISOString(),
      title: '',
      summary: '',
      tags: [],
      text: '',
      url: '',
      pageTitle: '',
      source: 'page', // 'page' | 'selection'
      model: '',
      ...fields,
    };
    await SoroAgent.ext.storage.local.set({ [PREFIX + snippet.id]: snippet });
    return snippet;
  }

  /**
   * Saves a snippet, replacing an earlier one with the same `dedupeKey` (e.g. re-summarizing an
   * unchanged page) while keeping its id, creation time and any research attached to it.
   */
  async function upsertSnippet(fields) {
    if (fields.dedupeKey) {
      const existing = (await listSnippets()).find((s) => s.dedupeKey === fields.dedupeKey);
      if (existing) {
        const updated = { ...existing, ...fields, id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString(), research: fields.research || existing.research };
        await SoroAgent.ext.storage.local.set({ [PREFIX + existing.id]: updated });
        return updated;
      }
    }
    return addSnippet(fields);
  }

  async function updateSnippet(id, patch) {
    const key = PREFIX + id;
    const current = (await SoroAgent.ext.storage.local.get(key))[key];
    if (!current) return null;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    await SoroAgent.ext.storage.local.set({ [key]: updated });
    return updated;
  }

  async function listSnippets() {
    const all = await SoroAgent.ext.storage.local.get(null);
    return Object.keys(all)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => all[key])
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function deleteSnippets(ids) {
    await SoroAgent.ext.storage.local.remove(ids.map((id) => PREFIX + id));
  }

  // Merges snippets from an export file; existing ids are kept as they are.
  async function importSnippets(items) {
    const existing = new Set((await listSnippets()).map((s) => s.id));
    const toSave = {};
    for (const item of items) {
      if (!item || typeof item !== 'object' || typeof item.text !== 'string') continue;
      const id = typeof item.id === 'string' && item.id ? item.id : newId();
      if (existing.has(id)) continue;
      toSave[PREFIX + id] = { ...item, id, tags: Array.isArray(item.tags) ? item.tags : [] };
    }
    await SoroAgent.ext.storage.local.set(toSave);
    return Object.keys(toSave).length;
  }

  /** Pure: a page address without its #fragment or trailing slash, for "same page" matching. */
  function pageKey(url) {
    try {
      const u = new URL(url);
      return `${u.origin}${u.pathname.replace(/\/+$/, '')}${u.search}`;
    } catch {
      return String(url || '');
    }
  }

  /** Snippets saved from this exact page, newest first. */
  async function snippetsForPage(url) {
    const key = pageKey(url);
    return (await listSnippets()).filter((s) => pageKey(s.url) === key);
  }

  function isSnippetChange(changes) {
    return Object.keys(changes).some((key) => key.startsWith(PREFIX));
  }

  Object.assign(SoroAgent, { addSnippet, upsertSnippet, updateSnippet, listSnippets, deleteSnippets, importSnippets, isSnippetChange, pageKey, snippetsForPage });
})(globalThis);
