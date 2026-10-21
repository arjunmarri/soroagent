// One answer from the model (local or cloud, whichever is set up) for soroagent's own pages:
// research topics on the snippets page, prompt optimizing in settings.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});

  /** Resolves with the model's full reply. `json` asks for a JSON reply where supported. */
  function askModel(messages, { json = false } = {}) {
    return new Promise((resolve, reject) => {
      const port = soroagent.ext.runtime.connect({ name: 'llm' });
      let settled = false;
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        try {
          port.disconnect();
        } catch {
          // already closed
        }
        fn(value);
      };
      port.onMessage.addListener((msg) => {
        if (msg.type === 'done') finish(resolve, msg.text || '');
        else if (msg.type === 'error') finish(reject, Object.assign(new Error(msg.error || 'The model did not answer.'), { hint: msg.hint || '' }));
      });
      port.onDisconnect.addListener(() => finish(reject, new Error('Lost the connection to the extension.')));
      port.postMessage({ type: 'chat', messages, json });
    });
  }

  soroagent.askModel = askModel;
})(globalThis);
