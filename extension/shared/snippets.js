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

  function isSnippetChange(changes) {
    return Object.keys(changes).some((key) => key.startsWith(PREFIX));
  }

  // ---------------------------------------------------------------------------
  // Timeline grouping (pure; unit tested)
  // ---------------------------------------------------------------------------

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  /** "Today", "Yesterday", a weekday within the last week, else a full date. */
  function dayLabel(date, now = new Date(), locale) {
    const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days > 1 && days < 7) return date.toLocaleDateString(locale, { weekday: 'long' });
    const sameYear = date.getFullYear() === now.getFullYear();
    return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  }

  /**
   * Groups snippets (newest first) into days and months for the timeline:
   * [{ key: '2026-10', label: 'October 2026', count, days: [{ key, label, items }] }]
   */
  function groupTimeline(snippets, now = new Date(), locale) {
    const months = [];
    const sorted = [...snippets].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const snippet of sorted) {
      const date = new Date(snippet.createdAt);
      if (Number.isNaN(date.getTime())) continue;
      const monthKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
      let month = months[months.length - 1];
      if (!month || month.key !== monthKey) {
        month = { key: monthKey, label: date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }), count: 0, days: [] };
        months.push(month);
      }
      const key = dayKey(date);
      let day = month.days[month.days.length - 1];
      if (!day || day.key !== key) {
        day = { key, label: dayLabel(date, now, locale), items: [] };
        month.days.push(day);
      }
      day.items.push(snippet);
      month.count++;
    }
    return months;
  }

  Object.assign(SoroAgent, { addSnippet, listSnippets, deleteSnippets, importSnippets, isSnippetChange, dayLabel, groupTimeline });
})(globalThis);
