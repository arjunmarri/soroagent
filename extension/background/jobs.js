// Summary jobs run in the background worker, not in the page. Leaving or closing the page
// doesn't stop them: the result lands in the summary history, the toolbar badge counts results
// you haven't seen, and the page shows them when you come back.
//
// Records are stored as "summary:<id>" in chrome.storage.local:
//   { id, createdAt, finishedAt, url, pageTitle, site, label, kind, fingerprint, model,
//     status: 'running' | 'done' | 'error' | 'stopped' | 'interrupted', statusText, text, error, hint, seen }
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});
  const PREFIX = 'summary:';
  const MAX_RECORDS = 300;

  // ---------------------------------------------------------------------------
  // Pure helpers (unit tested)
  // ---------------------------------------------------------------------------

  /** Replaces `placeholder` in every message's content (used to insert merged notes). */
  function fillPlaceholder(messages, placeholder, text) {
    return messages.map((m) => ({ ...m, content: String(m.content).split(placeholder).join(text) }));
  }

  /** Ids to delete so that at most `max` records remain, oldest first; running jobs are kept. */
  function idsToPrune(records, max = MAX_RECORDS) {
    const sorted = [...records].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return sorted.slice(max).filter((r) => r.status !== 'running').map((r) => r.id);
  }

  /** Records a page should show when it opens: running jobs and unseen results for its URL. */
  function pendingForUrl(records, url) {
    return records
      .filter((r) => r.url === url && (r.status === 'running' || !r.seen))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  }

  const unseenCount = (records) => records.filter((r) => r.status !== 'running' && !r.seen).length;

  // ---------------------------------------------------------------------------
  // Runner
  // ---------------------------------------------------------------------------

  /**
   * opts: { ext, runChat({ messages, model, signal, onToken, onThinking }) → text, errorPayload(err) }
   */
  function createJobRunner({ ext, runChat, errorPayload }) {
    const jobs = new Map(); // id -> { record, controller, ports: Set }
    let keepAlive = 0;

    const key = (id) => PREFIX + id;
    const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    async function allRecords() {
      const all = await ext.storage.local.get(null);
      return Object.keys(all).filter((k) => k.startsWith(PREFIX)).map((k) => all[k]);
    }

    async function save(record) {
      await ext.storage.local.set({ [key(record.id)]: record });
    }

    async function updateBadge() {
      try {
        const count = unseenCount(await allRecords());
        await ext.action.setBadgeText({ text: count ? String(count) : '' });
        if (ext.action.setBadgeBackgroundColor) await ext.action.setBadgeBackgroundColor({ color: '#4f46e5' });
      } catch {
        // badges are best-effort
      }
    }

    // Chrome stops an idle service worker after ~30 s; extension API calls keep it alive
    // while a model is loading or thinking.
    function holdOpen() {
      if (!keepAlive) keepAlive = setInterval(() => ext.runtime.getPlatformInfo().catch(() => {}), 20000);
    }
    function release() {
      if (!jobs.size && keepAlive) {
        clearInterval(keepAlive);
        keepAlive = 0;
      }
    }

    function broadcast(job, msg) {
      for (const port of job.ports) {
        try {
          port.postMessage(msg);
        } catch {
          job.ports.delete(port);
        }
      }
    }

    async function prune() {
      const ids = idsToPrune(await allRecords());
      if (ids.length) await ext.storage.local.remove(ids.map(key));
    }

    async function run(job, spec) {
      const { record } = job;
      let lastSave = 0;
      const progress = (text) => {
        record.statusText = text;
        broadcast(job, { type: 'status', text });
        save(record);
      };
      try {
        // Long content: notes on each part first, then one summary of all the notes.
        const notes = [];
        for (let i = 0; i < (spec.notes || []).length; i++) {
          progress(`Reading part ${i + 1} of ${spec.notes.length}…`);
          const text = await runChat({ messages: spec.notes[i], model: record.model, signal: job.controller.signal });
          notes.push(`--- Part ${i + 1} ---\n${text}`);
        }
        if (notes.length) progress('Writing the summary…');
        const final = notes.length ? fillPlaceholder(spec.final, spec.placeholder, notes.join('\n\n')) : spec.final;
        record.text = '';
        const text = await runChat({
          messages: final,
          model: record.model,
          signal: job.controller.signal,
          onThinking: () => broadcast(job, { type: 'thinking' }),
          onToken: (token) => {
            record.text += token;
            broadcast(job, { type: 'token', text: token });
            // Save now and then so the history page shows progress (and the worker stays alive).
            if (Date.now() - lastSave > 1500) {
              lastSave = Date.now();
              save(record);
            }
          },
        });
        Object.assign(record, { text, status: 'done', statusText: '', finishedAt: new Date().toISOString(), seen: job.ports.size > 0 });
      } catch (err) {
        const stopped = err && err.name === 'AbortError';
        const payload = stopped ? {} : errorPayload(err);
        Object.assign(record, {
          status: stopped ? 'stopped' : 'error',
          statusText: '',
          error: stopped ? 'Stopped.' : payload.error,
          hint: payload.hint || '',
          finishedAt: new Date().toISOString(),
          seen: stopped || job.ports.size > 0,
        });
      }
      await save(record);
      broadcast(job, { type: record.status === 'done' ? 'done' : 'error', record });
      jobs.delete(record.id);
      release();
      updateBadge();
    }

    /** Starts a summary job. spec: { url, pageTitle, site, label, kind, fingerprint, model, notes, final, placeholder } */
    async function start(spec, port) {
      const record = {
        id: newId(),
        createdAt: new Date().toISOString(),
        finishedAt: '',
        url: spec.url,
        pageTitle: spec.pageTitle || '',
        site: spec.site || '',
        label: spec.label || 'Summary',
        kind: spec.kind || 'page',
        fingerprint: spec.fingerprint || '',
        model: spec.model || '',
        status: 'running',
        statusText: '',
        text: '',
        error: '',
        hint: '',
        seen: false,
      };
      const job = { record, controller: new AbortController(), ports: new Set(port ? [port] : []) };
      jobs.set(record.id, job);
      holdOpen();
      await save(record);
      await prune();
      if (port) port.postMessage({ type: 'started', id: record.id });
      run(job, spec); // continues even if the page goes away
      return record.id;
    }

    /** Re-connects a page to a running job: sends what's been written so far, then live updates. */
    function attach(id, port) {
      const job = jobs.get(id);
      if (!job) return false;
      job.ports.add(port);
      port.postMessage({ type: 'snapshot', record: job.record });
      return true;
    }

    function detach(port) {
      for (const job of jobs.values()) job.ports.delete(port);
    }

    function stop(id) {
      const job = jobs.get(id);
      if (job) job.controller.abort();
    }

    async function markSeen(ids) {
      const all = await ext.storage.local.get(ids.map(key));
      const updates = {};
      for (const id of ids) {
        const record = all[key(id)];
        if (record && !record.seen) updates[key(id)] = { ...record, seen: true };
      }
      if (Object.keys(updates).length) await ext.storage.local.set(updates);
      updateBadge();
    }

    async function remove(ids) {
      ids.forEach(stop);
      await ext.storage.local.remove(ids.map(key));
      updateBadge();
    }

    // The newest finished summary of exactly this content, if any (to avoid re-summarizing).
    async function find(url, fingerprint) {
      if (!fingerprint) return null;
      const matches = (await allRecords())
        .filter((r) => r.url === url && r.fingerprint === fingerprint && r.status === 'done')
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return matches[0] || null;
    }

    async function forUrl(url) {
      return pendingForUrl(await allRecords(), url).map((r) => ({ ...r, live: jobs.has(r.id) }));
    }

    // After a browser or worker restart, jobs that were running can't resume.
    async function recover() {
      const stale = (await allRecords()).filter((r) => r.status === 'running' && !jobs.has(r.id));
      if (stale.length) {
        const updates = {};
        for (const r of stale) {
          updates[key(r.id)] = {
            ...r,
            status: 'interrupted',
            error: 'This summary was interrupted when the browser stopped SoroAgent.',
            hint: 'Run Summarize again on the page.',
            finishedAt: new Date().toISOString(),
          };
        }
        await ext.storage.local.set(updates);
      }
      updateBadge();
    }

    return { start, attach, detach, stop, markSeen, remove, find, forUrl, recover, updateBadge };
  }

  Object.assign(SoroAgent, { createJobRunner, fillPlaceholder, idsToPrune, pendingForUrl, unseenCount, SUMMARY_PREFIX: PREFIX });
})(globalThis);
