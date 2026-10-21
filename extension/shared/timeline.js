// Groups dated records (snippets, summaries) by month and day for the timeline views.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});

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
   * Groups records with a createdAt (newest first) into days and months for the timeline:
   * [{ key: '2026-10', label: 'October 2026', count, days: [{ key, label, items }] }]
   */
  function groupTimeline(records, now = new Date(), locale) {
    const months = [];
    const sorted = [...records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    for (const record of sorted) {
      const date = new Date(record.createdAt);
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
      day.items.push(record);
      month.count++;
    }
    return months;
  }

  Object.assign(SoroAgent, { dayLabel, groupTimeline });
})(globalThis);
