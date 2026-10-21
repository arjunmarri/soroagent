(function () {
  'use strict';

  const { ext, listSnippets, deleteSnippets, importSnippets, isSnippetChange, groupTimeline } = globalThis.SoroAgent;
  const $ = (id) => document.getElementById(id);
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };

  const VIEW_KEY = 'soroagent.snippetsView';
  let snippets = [];
  let tagFilter = '';
  let siteFilter = '';
  let view = 'timeline';
  try {
    view = localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'timeline';
  } catch {
    // storage unavailable: keep the default
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  // A stable color per site for its letter badge.
  function siteColor(host) {
    let hash = 0;
    for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `hsl(${hash % 360} 45% 45%)`;
  }

  function matches(snippet, query) {
    if (tagFilter && !snippet.tags.includes(tagFilter)) return false;
    if (siteFilter && hostOf(snippet.url) !== siteFilter) return false;
    if (!query) return true;
    const haystack = [snippet.title, snippet.summary, snippet.text, snippet.pageTitle, snippet.url, ...snippet.tags].join(' ').toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  }

  const formatDate = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };
  const formatTime = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  function renderCard(snippet, { showDate }) {
    const text = el('div', { className: 'text', textContent: snippet.text });
    const toggle = el('button', { className: 'btn small', type: 'button', textContent: 'Show full text' });
    toggle.addEventListener('click', () => {
      const open = text.classList.toggle('open');
      toggle.textContent = open ? 'Show less' : 'Show full text';
    });
    const copy = el('button', { className: 'btn small', type: 'button', textContent: 'Copy' });
    copy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`${snippet.title}\n${snippet.url}\n\n${snippet.text}`);
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy'), 1500);
    });
    const remove = el('button', { className: 'btn small danger', type: 'button', textContent: 'Delete' });
    remove.addEventListener('click', () => deleteSnippets([snippet.id]));

    const host = hostOf(snippet.url);
    const meta = el('div', { className: 'meta' });
    if (host) {
      const site = el('button', { type: 'button', className: 'site', title: `Show only snippets from ${host}` }, [
        el('span', { className: 'avatar', textContent: host[0].toUpperCase(), style: `background:${siteColor(host)}` }),
        el('span', { textContent: host }),
      ]);
      site.addEventListener('click', () => {
        siteFilter = host;
        render();
      });
      meta.append(site);
    }
    if (showDate) meta.append(el('span', { textContent: formatDate(snippet.createdAt) }));
    meta.append(el('span', { textContent: snippet.source === 'selection' ? 'Selection' : 'Whole page' }));
    if (/^https?:/.test(snippet.url)) meta.append(el('a', { href: snippet.url, target: '_blank', rel: 'noopener', textContent: 'Open ↗', title: snippet.pageTitle || snippet.url }));

    const item = el('article', { className: showDate ? 'item' : 'item compact' }, [el('h2', { textContent: snippet.title }), meta]);
    if (snippet.summary) item.append(el('p', { className: 'summary', textContent: snippet.summary }));
    if (snippet.tags.length) {
      item.append(
        el('div', { className: 'tags' }, snippet.tags.map((tag) => {
          const chip = el('button', { className: 'tag', type: 'button', textContent: `#${tag}` });
          chip.addEventListener('click', () => {
            tagFilter = tag;
            render();
          });
          return chip;
        }))
      );
    }
    item.append(text, el('div', { className: 'actions' }, [toggle, copy, remove]));
    return item;
  }

  function renderList(visible) {
    return el('div', { className: 'list' }, visible.map((s) => renderCard(s, { showDate: true })));
  }

  function renderTimeline(visible) {
    const months = groupTimeline(visible);
    const index = el('nav', { className: 'months', ariaLabel: 'Jump to month' }, [el('div', { className: 'months-title', textContent: 'Months' })]);
    const content = el('div', { className: 'timeline' });
    for (const month of months) {
      const section = el('section', { className: 'month', id: `month-${month.key}` }, [el('h2', { className: 'month-label', textContent: month.label })]);
      for (const day of month.days) {
        const head = el('div', { className: 'day-head' }, [
          el('span', { textContent: day.label }),
          el('small', { textContent: `${day.items.length} snippet${day.items.length === 1 ? '' : 's'}` }),
        ]);
        const rail = el('div', { className: 'rail' }, day.items.map((s) =>
          el('div', { className: 'entry' }, [el('time', { dateTime: s.createdAt, textContent: formatTime(s.createdAt) }), renderCard(s, { showDate: false })])
        ));
        section.append(el('div', { className: 'day' }, [head, rail]));
      }
      content.append(section);
      const jump = el('button', { type: 'button' }, [document.createTextNode(month.label), el('span', { textContent: String(month.count) })]);
      jump.addEventListener('click', () => {
        document.getElementById(`month-${month.key}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
        index.querySelectorAll('button').forEach((b) => b.classList.toggle('current', b === jump));
      });
      index.append(jump);
    }
    return el('div', { className: 'timeline-layout' }, [index, content]);
  }

  function renderFilters() {
    const box = $('filters');
    box.replaceChildren();
    const add = (label, value, clear) => {
      const button = el('button', { className: 'btn small', type: 'button', textContent: 'Clear' });
      button.addEventListener('click', () => {
        clear();
        render();
      });
      box.append(el('span', { textContent: label }), el('span', { className: 'tag', textContent: value }), button);
    };
    if (tagFilter) add('Tag:', `#${tagFilter}`, () => (tagFilter = ''));
    if (siteFilter) add('Site:', siteFilter, () => (siteFilter = ''));
    box.hidden = !tagFilter && !siteFilter;
  }

  function render() {
    const query = $('search').value.trim().toLowerCase();
    const visible = snippets.filter((s) => matches(s, query));
    $('count').textContent = snippets.length ? `(${snippets.length})` : '';
    for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    renderFilters();
    if (!visible.length) {
      $('view').replaceChildren(
        el('div', {
          className: 'empty',
          textContent: snippets.length
            ? 'No snippets match.'
            : 'No snippets yet. Open SoroAgent on any page and click “Save”, or right-click selected text.',
        })
      );
      return;
    }
    $('view').replaceChildren(view === 'timeline' ? renderTimeline(visible) : renderList(visible));
  }

  async function load() {
    snippets = (await listSnippets()).map((s) => ({ ...s, tags: Array.isArray(s.tags) ? s.tags : [] }));
    render();
  }

  function download(name, type, content) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    el('a', { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stamp = () => new Date().toISOString().slice(0, 10);

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => {
      view = button.dataset.view;
      try {
        localStorage.setItem(VIEW_KEY, view);
      } catch {
        // not saved; the view still switches
      }
      render();
    });
  }

  $('exportJson').addEventListener('click', () => {
    download(`soroagent-snippets-${stamp()}.json`, 'application/json', JSON.stringify(snippets, null, 2));
  });

  $('exportMd').addEventListener('click', () => {
    const md = snippets
      .map((s) => {
        const tags = s.tags.length ? `\n${s.tags.map((t) => `#${t}`).join(' ')}` : '';
        const quoted = s.text.split('\n').map((line) => `> ${line}`).join('\n');
        return `## ${s.title}\n\n${s.url}  \n_${formatDate(s.createdAt)}_${tags}\n\n${s.summary}\n\n${quoted}\n`;
      })
      .join('\n---\n\n');
    download(`soroagent-snippets-${stamp()}.md`, 'text/markdown', `# SoroAgent snippets\n\n${md}`);
  });

  $('import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const items = JSON.parse(await file.text());
      const added = await importSnippets(Array.isArray(items) ? items : []);
      alert(`Imported ${added} snippet${added === 1 ? '' : 's'}.`);
    } catch (err) {
      alert(`Couldn't import that file: ${err.message}`);
    }
  });

  $('clear').addEventListener('click', async () => {
    if (!snippets.length) return;
    if (confirm(`Delete all ${snippets.length} snippets? Export them first if you want a backup.`)) {
      await deleteSnippets(snippets.map((s) => s.id));
    }
  });

  $('search').addEventListener('input', render);

  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && isSnippetChange(changes)) load();
  });

  load();
})();
