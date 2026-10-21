// Hidden helper for Chrome's background worker, which can't create blob URLs itself: turns the
// automatic backup's JSON into a URL the downloads API can save.
(function () {
  'use strict';

  const ext = globalThis.chrome;
  ext.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (sender.id !== ext.runtime.id || !msg) return false;
    if (msg.type === 'offscreen:blob') {
      sendResponse({ url: URL.createObjectURL(new Blob([msg.json], { type: 'application/json' })) });
    } else if (msg.type === 'offscreen:revoke') {
      URL.revokeObjectURL(msg.url);
      sendResponse({ ok: true });
    }
    return false;
  });
})();
