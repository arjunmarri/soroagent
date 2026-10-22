(function () {
  'use strict';

  const S = globalThis.soroagent;
  const { ext, STATS_PREFIX, statsDayKey, summarizeStats, formatDuration } = S;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  const PREFS_KEY = 'soroagent.statsRange';
  let range = 7;
  try {
    range = Number(localStorage.getItem(PREFS_KEY)) || 7;
  } catch {
    // default range
  }
  let byDay = {};
  let siteFilter = '';
  let showAllPages = false;

  const siteColor = (host) => {
    let hash = 0;
    for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 45% 42%)`;
  };
  const percent = (part, whole) => {
    const p = (part / whole) * 100;
    return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`;
  };
  const dayDate = (key) => new Date(`${key}T12:00:00`);
  const dayLabel = (key, opts) => dayDate(key).toLocaleDateString(undefined, opts);

  // The last `range` calendar days, oldest first, including days with no browsing.
  function rangeDays() {
    const days = [];
    const today = new Date();
    for (let i = range - 1; i >= 0; i--) days.push(statsDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
    return days;
  }

  function tile(label, value, note) {
    return el('div', { className: 'tile' }, [
      el('div', { className: 'tile-label', textContent: label }),
      el('div', { className: 'tile-value', textContent: value }),
      el('div', { className: 'tile-note', textContent: note || ' ' }),
    ]);
  }

  // A "nice" top for the y axis, in minutes: 30m, 1h, 2h, 3h…
  function axisMax(ms) {
    const minutes = ms / 60000;
    const steps = [10, 20, 30, 60, 90, 120, 180, 240, 360, 480, 720, 960, 1440];
    return (steps.find((s) => s >= minutes) || 1440) * 60000;
  }

  let tip = null;
  function showTip(target, html) {
    hideTip();
    tip = el('div', { className: 'tip' });
    tip.append(...html);
    document.body.append(tip);
    const box = target.getBoundingClientRect();
    const width = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, box.left + box.width / 2 - width / 2))}px`;
    tip.style.top = `${box.top - tip.offsetHeight - 8}px`;
  }
  function hideTip() {
    if (tip) tip.remove();
    tip = null;
  }

  function dayChart(days, perDay) {
    const today = statsDayKey();
    const max = axisMax(Math.max(...days.map((d) => perDay[d] || 0), 60000));
    const chart = el('div', { className: 'chart', role: 'img' });
    chart.setAttribute('aria-label', `Browsing time per day for the last ${days.length} days`);
    for (const fraction of [1, 0.5, 0]) {
      chart.append(el('div', { className: 'grid-line', style: `top:${(1 - fraction) * 100}%` }, [el('span', { textContent: fraction ? formatDuration(max * fraction) : '0' })]));
    }
    const bars = el('div', { className: 'bars' });
    for (const day of days) {
      const ms = perDay[day] || 0;
      const bar = el('div', { className: `bar${day === today ? ' today' : ''}`, tabIndex: 0 });
      bar.setAttribute('aria-label', `${dayLabel(day, { weekday: 'long', day: 'numeric', month: 'long' })}: ${formatDuration(ms)}`);
      bar.append(el('i', { style: `height:${Math.round((ms / max) * 1000) / 10}%` }));
      const tipBody = () => [el('span', { textContent: day === today ? 'Today' : dayLabel(day, { weekday: 'short', day: 'numeric', month: 'short' }) }), el('b', { textContent: formatDuration(ms) })];
      bar.addEventListener('mouseenter', () => showTip(bar, tipBody()));
      bar.addEventListener('focus', () => showTip(bar, tipBody()));
      bar.addEventListener('mouseleave', hideTip);
      bar.addEventListener('blur', hideTip);
      bars.append(bar);
    }
    chart.append(bars);
    // Label every day for a week; about weekly otherwise, always including today.
    const every = days.length <= 7 ? 1 : days.length <= 30 ? 5 : 14;
    const labels = el('div', { className: 'x-labels', ariaHidden: 'true' }, days.map((day, i) => {
      const show = day === today || ((days.length - 1 - i) % every === 0 && days.length - 1 - i >= Math.ceil(every / 2));
      return el('span', {
        className: day === today ? 'today' : '',
        textContent: !show ? '' : day === today ? 'Today' : days.length <= 7 ? dayLabel(day, { weekday: 'short' }) : dayLabel(day, { day: 'numeric', month: 'short' }),
      });
    }));
    // The same numbers as a table, for screen readers.
    const table = el('table', { className: 'sr-only' }, [
      el('caption', { textContent: 'Browsing time per day' }),
      el('tbody', {}, days.map((day) => el('tr', {}, [el('th', { textContent: dayLabel(day, { dateStyle: 'medium' }) }), el('td', { textContent: formatDuration(perDay[day] || 0) })]))),
    ]);
    return [chart, labels, table];
  }

  function render() {
    for (const b of document.querySelectorAll('[data-range]')) b.setAttribute('aria-pressed', String(Number(b.dataset.range) === range));
    const days = rangeDays();
    const inRange = Object.fromEntries(days.filter((d) => byDay[d]).map((d) => [d, byDay[d]]));
    const stats = summarizeStats(inRange);
    const content = $('content');
    hideTip();
    if (!stats.total) {
      content.replaceChildren(el('div', { className: 'empty', textContent: range === 1 ? 'No browsing time counted yet today.' : 'No browsing time counted in this period yet.' }));
      return;
    }
    const perDay = Object.fromEntries(stats.days.map((d) => [d.day, d.ms]));
    const activeDays = stats.days.filter((d) => d.ms > 0).length;
    const top = stats.sites[0];
    const nodes = [
      el('div', { className: 'tiles' }, [
        tile(range === 1 ? 'Today' : 'Total time', formatDuration(stats.total), range === 1 ? `across ${stats.pages.length} page${stats.pages.length === 1 ? '' : 's'}` : `over ${activeDays} day${activeDays === 1 ? '' : 's'} with browsing`),
        range === 1 ? tile('Pages', String(stats.pages.length), 'visited for more than a moment') : tile('Daily average', formatDuration(stats.total / days.length), `per day over ${days.length} days`),
        tile('Websites', String(stats.sites.length), ''),
        tile('Most time on', top.host, `${formatDuration(top.ms)} · ${percent(top.ms, stats.total)} of your time`),
      ]),
    ];
    if (range > 1) {
      nodes.push(el('section', { className: 'panel' }, [
        el('h2', {}, [el('span', { textContent: 'Time per day' }), el('small', { textContent: `${dayLabel(days[0], { day: 'numeric', month: 'short' })} – today` })]),
        ...dayChart(days, perDay),
      ]));
    }

    // Websites, busiest first; click one to see its pages.
    const maxSite = stats.sites[0].ms;
    const siteRows = stats.sites.slice(0, 25).map((site) => {
      const row = el('button', { type: 'button', className: 'site-row' }, [
        el('span', { className: 'avatar', textContent: (site.host[0] || '?').toUpperCase(), style: `background:${siteColor(site.host)}` }),
        el('span', { className: 'name', textContent: site.host }),
        el('span', { className: 'time' }, [document.createTextNode(formatDuration(site.ms)), el('small', { textContent: percent(site.ms, stats.total) })]),
        el('span', { className: 'meter' }, [el('i', { style: `width:${Math.max(1, (site.ms / maxSite) * 100)}%` })]),
      ]);
      row.setAttribute('aria-pressed', String(site.host === siteFilter));
      row.addEventListener('click', () => {
        siteFilter = siteFilter === site.host ? '' : site.host;
        showAllPages = false;
        render();
      });
      return row;
    });

    const pages = stats.pages.filter((p) => !siteFilter || p.host === siteFilter);
    const shown = showAllPages ? pages.slice(0, 300) : pages.slice(0, 25);
    const pageRows = shown.map((page) => el('div', { className: 'page-row' }, [
      el('a', { href: S.safeUrl(page.url), target: '_blank', rel: 'noopener noreferrer', textContent: page.title || page.url, title: page.url }),
      el('span', { className: 'time', textContent: formatDuration(page.ms) }),
      el('small', { textContent: page.url.replace(/^https?:\/\/(www\.)?/, '') }),
    ]));
    const pagePanel = el('section', { className: 'panel' }, [
      el('h2', {}, [el('span', { textContent: siteFilter ? `Pages on ${siteFilter}` : 'Pages' }), el('small', { textContent: `${pages.length} page${pages.length === 1 ? '' : 's'}` })]),
    ]);
    if (siteFilter) {
      const clear = el('button', { type: 'button', className: 'btn small', textContent: 'Show all websites' });
      clear.addEventListener('click', () => {
        siteFilter = '';
        render();
      });
      pagePanel.append(el('div', { className: 'filter-note' }, [el('span', { textContent: 'Filtered by website.' }), clear]));
    }
    pagePanel.append(el('div', { className: 'rows' }, pageRows));
    if (pages.length > shown.length) {
      const more = el('button', { type: 'button', className: 'btn small', textContent: `Show all ${pages.length} pages`, style: 'margin-top:8px' });
      more.addEventListener('click', () => {
        showAllPages = true;
        render();
      });
      pagePanel.append(more);
    }

    nodes.push(el('div', { className: 'cols' }, [
      el('section', { className: 'panel' }, [
        el('h2', {}, [el('span', { textContent: 'Websites' }), el('small', { textContent: 'click one to see its pages' })]),
        el('div', { className: 'rows' }, siteRows),
      ]),
      pagePanel,
    ]));
    content.replaceChildren(...nodes);
  }

  async function load() {
    const all = await ext.storage.local.get(null);
    byDay = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(STATS_PREFIX)) byDay[key.slice(STATS_PREFIX.length)] = S.mergeDays(byDay[key.slice(STATS_PREFIX.length)], value);
    }
    // Time from your other browsers (synced), added in.
    for (const [key, value] of Object.entries(all)) {
      const m = key.match(/^xstats:[^:]+:(\d{4}-\d{2}-\d{2})$/);
      if (m) byDay[m[1]] = S.mergeDays(byDay[m[1]], value);
    }
    $('off').hidden = !(all.settings && all.settings.trackTime === false);
    render();
  }

  for (const b of document.querySelectorAll('[data-range]')) {
    b.addEventListener('click', () => {
      range = Number(b.dataset.range);
      siteFilter = '';
      showAllPages = false;
      try {
        localStorage.setItem(PREFS_KEY, String(range));
      } catch {
        // not remembered; still applied
      }
      render();
    });
  }
  $('clear').addEventListener('click', async () => {
    if (!confirm('Clear all browsing stats? This cannot be undone.')) return;
    await ext.runtime.sendMessage({ type: 'stats:clear' });
    load();
  });

  // Live while open: browsing in other tabs keeps adding time.
  let pending = 0;
  ext.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.keys(changes).some((k) => k.startsWith(STATS_PREFIX) || k === 'settings')) return;
    clearTimeout(pending);
    pending = setTimeout(load, 1000);
  });
  window.addEventListener('scroll', hideTip, { passive: true });

  load();
})();
