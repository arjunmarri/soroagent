// Markdown folder sync: the archivist keeps a clean .md file with YAML frontmatter for every note in
// a folder on disk, such as an Obsidian vault or a Logseq graph. One way (soroagent → folder): new
// notes are written, changed notes rewritten (renamed when their title changes), deleted notes
// removed. Files you edited in the folder are left alone.
// Chrome, Edge, Brave and Arc write to a folder the user picks (File System Access); Firefox, which
// can't, writes to Downloads/soroagent/notes/. The formatting and planning are pure (unit tested).
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  const EXPORT_KINDS = new Set(['summary', 'research', 'selection', 'page', 'deliverable', 'read']);
  const TYPE_NAMES = { summary: 'summary', research: 'research', selection: 'highlight', page: 'saved page', deliverable: 'created', read: 'read' };
  const DOWNLOADS_FOLDER = 'soroagent/notes';

  // ---------------------------------------------------------------------------
  // Pure: notes as Markdown
  // ---------------------------------------------------------------------------

  const yamlString = (s) => JSON.stringify(String(s || '')); // a JSON string is a valid YAML double-quoted string
  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };
  const clean = (text) => (soroagent.stripThinking ? soroagent.stripThinking(text || '') : String(text || '')).replace(/\r\n?/g, '\n').trim();

  /** Pure: a note as a Markdown document with YAML frontmatter. */
  function noteToMarkdown(note) {
    const kind = note.kind || 'page';
    const tags = (note.tags || []).map((t) => String(t).replace(/[^\w/-]+/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean);
    const front = [
      '---',
      `title: ${yamlString(note.title || note.pageTitle || 'Untitled')}`,
      note.url ? `source: ${yamlString(note.url)}` : '',
      hostOf(note.url) ? `site: ${yamlString(hostOf(note.url))}` : '',
      `type: ${yamlString(TYPE_NAMES[kind] || kind)}`,
      tags.length ? `tags:\n${tags.map((t) => `  - ${t}`).join('\n')}` : 'tags: []',
      `created: ${note.createdAt || ''}`,
      note.updatedAt ? `updated: ${note.updatedAt}` : '',
      note.model ? `model: ${yamlString(note.model)}` : '',
      `soroagent_id: ${yamlString(note.id)}`,
      '---',
    ].filter(Boolean);
    const body = [`# ${note.title || note.pageTitle || 'Untitled'}`];
    if (note.url) body.push(`[${hostOf(note.url) || 'Source'}](${note.url})`);
    const summary = clean(note.summary);
    const text = clean(note.text);
    if (kind === 'summary' || kind === 'research' || kind === 'deliverable') {
      body.push(text || summary);
    } else {
      if (summary) body.push(`> ${summary.replace(/\n/g, '\n> ')}`);
      if (text && text !== summary) body.push(kind === 'selection' ? `> ${text.replace(/\n/g, '\n> ')}` : `## From the page\n\n${text}`);
    }
    if (note.research && note.research.text && kind !== 'research') {
      body.push(`## Research${note.research.query ? `: ${note.research.query}` : ''}\n\n${clean(note.research.text)}`);
      const sources = (note.research.sources || []).filter((s) => /^https?:/.test(s.url || ''));
      if (sources.length) body.push(`### Sources\n\n${sources.map((s, i) => `${i + 1}. [${String(s.title || hostOf(s.url)).replace(/[[\]]/g, '')}](${s.url})`).join('\n')}`);
    }
    return `${front.join('\n')}\n\n${body.filter(Boolean).join('\n\n')}\n`;
  }

  /** Pure: a safe, readable file name for a title (no path characters, not too long). */
  function safeFileName(title) {
    const base = String(title || 'Untitled')
      .replace(/[\\/:*?"<>|#^[\]\u0000-\u001f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(0, 90)
      .trim();
    return base || 'Untitled';
  }

  /** Pure: FNV-1a of a document, to tell when it changed. */
  function hashOf(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  /**
   * Pure: what to do to bring the folder in line with the notes.
   * index: { [noteId]: { name, hash } } from the last export.
   * Returns { writes: [{ id, name, content, hash, replaces }], deletes: [{ id, name }] }.
   */
  function planExport(notes, index = {}) {
    const exportable = (notes || []).filter((n) => n && n.id && EXPORT_KINDS.has(n.kind || 'page'));
    const ids = new Set(exportable.map((n) => n.id));
    // Names stay with their notes; new notes get a free name (adding " 2", " 3"… if needed).
    const taken = new Set(Object.entries(index).filter(([id]) => ids.has(id)).map(([, v]) => v.name.toLowerCase()));
    const writes = [];
    for (const note of [...exportable].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))) {
      const content = noteToMarkdown(note);
      const hash = hashOf(content);
      const prev = index[note.id];
      const wanted = safeFileName(note.title || note.pageTitle);
      let name = prev ? prev.name : '';
      if (!prev || !name.toLowerCase().startsWith(wanted.toLowerCase())) {
        if (prev) taken.delete(prev.name.toLowerCase());
        name = `${wanted}.md`;
        for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${wanted} ${n}.md`;
        taken.add(name.toLowerCase());
      }
      if (!prev || prev.hash !== hash || prev.name !== name) writes.push({ id: note.id, name, content, hash, replaces: prev && prev.name !== name ? prev.name : '' });
    }
    const deletes = Object.entries(index).filter(([id]) => !ids.has(id)).map(([id, v]) => ({ id, name: v.name }));
    return { writes, deletes };
  }

  // ---------------------------------------------------------------------------
  // Writers (background worker)
  // ---------------------------------------------------------------------------

  // The chosen folder's handle lives in IndexedDB (handles can't go in extension storage).
  function handleStore(idb = root.indexedDB) {
    let db;
    const open = () => (db ||= new Promise((resolve, reject) => {
      const req = idb.open('soroagent-markdown', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('handles');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
    const run = async (mode, fn) => {
      const d = await open();
      return new Promise((resolve, reject) => {
        const tx = d.transaction('handles', mode);
        const req = fn(tx.objectStore('handles'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      });
    };
    return { get: () => run('readonly', (s) => s.get('folder')), set: (h) => run('readwrite', (s) => s.put(h, 'folder')), clear: () => run('readwrite', (s) => s.delete('folder')) };
  }

  // Folder writer (File System Access): writes, never touches files edited since soroagent wrote them.
  function folderWriter(dir) {
    return {
      async write(name, content, prev) {
        if (prev && prev.at) {
          try {
            const file = await (await dir.getFileHandle(prev.name)).getFile();
            if (file.lastModified > prev.at + 3000) return { skipped: true }; // edited in the vault
          } catch {
            // gone: write it again
          }
        }
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(content);
        await w.close();
        return { at: Date.now() };
      },
      async remove(entry) {
        try {
          const file = await (await dir.getFileHandle(entry.name)).getFile();
          if (entry.at && file.lastModified > entry.at + 3000) return { skipped: true };
          await dir.removeEntry(entry.name);
        } catch {
          // already gone
        }
        return {};
      },
    };
  }

  // Downloads writer (Firefox): Downloads/soroagent/notes/, overwriting; deletes what it wrote.
  function downloadsWriter(ext) {
    const asUrl = (content) => (typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(new Blob([content], { type: 'text/markdown' }))
      : `data:text/markdown;charset=utf-8,${encodeURIComponent(content)}`);
    return {
      async write(name, content) {
        const url = asUrl(content);
        const downloadId = await ext.downloads.download({ url, filename: `${DOWNLOADS_FOLDER}/${name}`, conflictAction: 'overwrite', saveAs: false });
        setTimeout(() => url.startsWith('blob:') && URL.revokeObjectURL(url), 10000);
        // Keep the download list clean; the file stays.
        setTimeout(() => ext.downloads.erase({ id: downloadId }).catch(() => {}), 4000);
        return { at: Date.now(), downloadId };
      },
      async remove(entry) {
        if (entry.downloadId) await ext.downloads.removeFile(entry.downloadId).catch(() => {});
        return {};
      },
    };
  }

  function createMarkdownExport({ ext, handles = handleStore() }) {
    let running = null;
    const getConfig = async () => (await ext.storage.local.get('markdownExport')).markdownExport || null;
    const getIndex = async () => (await ext.storage.local.get('markdownIndex')).markdownIndex || {};

    async function writer(cfg) {
      if (cfg.mode === 'downloads') return downloadsWriter(ext);
      const dir = await handles.get();
      if (!dir) throw Object.assign(new Error('Choose the folder again in Settings.'), { code: 'no-folder' });
      const permission = dir.queryPermission ? await dir.queryPermission({ mode: 'readwrite' }) : 'granted';
      if (permission !== 'granted') throw Object.assign(new Error('soroagent needs permission to write to the folder again.'), { code: 'permission' });
      return folderWriter(dir);
    }

    /** Writes what changed. Resolves with { written, deleted, skipped }. */
    function exportNow() {
      running = running || (async () => {
        const cfg = await getConfig();
        if (!cfg) return { off: true };
        const w = await writer(cfg);
        const notes = await soroagent.listSnippets();
        const index = await getIndex();
        const plan = planExport(notes, index);
        let skipped = 0;
        for (const item of plan.writes) {
          const prev = index[item.id];
          const res = await w.write(item.name, item.content, prev && !item.replaces ? prev : null);
          if (res.skipped) {
            skipped++;
            continue;
          }
          if (item.replaces) await w.remove({ ...prev, name: item.replaces });
          index[item.id] = { name: item.name, hash: item.hash, at: res.at, downloadId: res.downloadId };
        }
        for (const item of plan.deletes) {
          const res = await w.remove(index[item.id]);
          if (res.skipped) skipped++;
          delete index[item.id];
        }
        const state = { lastExport: new Date().toISOString(), files: Object.keys(index).length, written: plan.writes.length - skipped, deleted: plan.deletes.length, skipped, error: '', code: '' };
        await ext.storage.local.set({ markdownIndex: index, markdownState: state });
        return state;
      })().catch(async (err) => {
        const st = (await ext.storage.local.get('markdownState')).markdownState || {};
        await ext.storage.local.set({ markdownState: { ...st, error: err.message || String(err), code: err.code || '' } });
        throw err;
      }).finally(() => {
        running = null;
      });
      return running;
    }

    async function enable({ mode, folderName = '' }) {
      await ext.storage.local.set({ markdownExport: { mode, folderName }, markdownIndex: {} });
      return exportNow();
    }
    async function disable() {
      await handles.clear().catch(() => {});
      await ext.storage.local.remove(['markdownExport', 'markdownIndex', 'markdownState']);
      return { ok: true };
    }
    async function status() {
      return { config: await getConfig(), ...(((await ext.storage.local.get('markdownState')).markdownState) || {}) };
    }

    return { exportNow, enable, disable, status, getConfig };
  }

  Object.assign(soroagent, { MARKDOWN_DOWNLOADS_FOLDER: DOWNLOADS_FOLDER, noteToMarkdown, safeFileName, planExport, markdownHandleStore: handleStore, createMarkdownExport });
})(globalThis);
