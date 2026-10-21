// Styles for the assistant. They live inside a shadow root, so pages can't restyle the
// assistant and the assistant can't leak styles into pages.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});

  SoroAgent.ASSISTANT_CSS = `
:host {
  all: initial;
  --bg: #ffffff;
  --bg-soft: #f5f5f7;
  --bg-hover: #ececf1;
  --fg: #18181b;
  --fg-muted: #6b6b76;
  --border: #e4e4e9;
  --accent: #4f46e5;
  --accent-fg: #ffffff;
  --accent-soft: #eef0ff;
  --ok: #16a34a;
  --warn: #d97706;
  --err: #dc2626;
  --shadow: 0 18px 50px rgba(15, 15, 30, 0.22), 0 2px 8px rgba(15, 15, 30, 0.08);
  --owl-bg: #FFFFFF;
  --owl-border: #E4E4E7;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--fg);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1c1c21;
    --bg-soft: #26262d;
    --bg-hover: #303038;
    --fg: #f1f1f4;
    --fg-muted: #a1a1ad;
    --border: #34343c;
    --accent: #8b85ff;
    --accent-fg: #14142b;
    --accent-soft: #2a2950;
    --shadow: 0 18px 50px rgba(0, 0, 0, 0.55), 0 2px 8px rgba(0, 0, 0, 0.3);
    --owl-bg: #111113;
    --owl-border: #2A2A2E;
  }
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
svg { width: 18px; height: 18px; flex: none; }

.launcher {
  position: fixed; right: 16px; bottom: 20px; z-index: 2147483647;
  width: 50px; height: 50px; border-radius: 50%; padding: 0; overflow: hidden;
  display: grid; place-items: center; touch-action: none;
  /* Follows the browser theme: white in light mode, near-black in dark mode. */
  background: var(--owl-bg); border: 1px solid var(--owl-border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18), 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease, box-shadow 0.15s ease, top 0.25s ease, left 0.25s ease, right 0.25s ease;
}
.launcher:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24), 0 1px 3px rgba(0, 0, 0, 0.1); }
.launcher.dragging { transition: none; cursor: grabbing; transform: scale(1.06); }
.launcher.busy::after {
  content: ""; position: absolute; inset: -1px; border-radius: 50%;
  border: 2px solid transparent; border-top-color: #34D399; animation: spin 0.9s linear infinite;
}

/* The owl. Its eye glints follow the mouse (--px/--py in -1..1, set by launcher.js) or drift on
   their own; it blinks now and then, looks around while working, perks up when the panel opens,
   flaps its wings while carried or flying, and hops when it lands. */
.owl { width: 100%; height: 100%; display: block; overflow: visible; }
.owl .bird, .owl .eyes, .owl .glint, .owl .wing { transform-box: fill-box; transform-origin: center; }
.owl .eyes { animation: blink 7s infinite; }
.owl .glint { transform: translate(calc(var(--px, 0) * 4px), calc(var(--py, 0) * 4px)); animation: watch 11s ease-in-out infinite; transition: transform 0.18s ease-out; }
.launcher.tracking .owl .glint { animation: none; }
.launcher:hover .owl .eyes { animation: none; transform: scale(1.05); transition: transform 0.2s ease; }
.launcher.open .owl { animation: perk 0.5s ease; }
.launcher.open .owl .glint { animation: none; transform: translate(calc(var(--px, 0) * 4px), calc(var(--py, 0) * 4px)) scale(1.3); }
.launcher.busy .owl .glint { animation: scan 1.4s ease-in-out infinite; }
.owl .wing-l { transform-origin: 85% 8%; }
.owl .wing-r { transform-origin: 15% 8%; }
.launcher.carried .owl .wing-l, .launcher.flying .owl .wing-l { animation: flap-l 0.2s ease-in-out infinite alternate; }
.launcher.carried .owl .wing-r, .launcher.flying .owl .wing-r { animation: flap-r 0.2s ease-in-out infinite alternate; }
.launcher.carried { cursor: grabbing; transform: scale(1.08); box-shadow: 0 16px 30px rgba(0, 0, 0, 0.3); }
.launcher.flying { transition: none !important; transform: rotate(var(--tilt, 0deg)) scale(1.04); }
.launcher.landing { animation: land 0.42s ease-out; }

.panel {
  position: fixed; right: 16px; bottom: 80px; z-index: 2147483647;
  width: min(400px, calc(100vw - 24px)); height: min(600px, calc(100vh - 100px));
  display: flex; flex-direction: column;
  background: var(--bg); border: 1px solid var(--border); border-radius: 16px;
  box-shadow: var(--shadow); overflow: hidden;
  animation: pop 0.16s ease-out;
}

header {
  position: relative; display: flex; align-items: center; gap: 8px;
  padding: 10px 10px 10px 14px; border-bottom: 1px solid var(--border);
}
.brand { display: flex; align-items: center; gap: 7px; font-weight: 650; letter-spacing: -0.01em; }
.brand-mark {
  width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; overflow: hidden;
  background: var(--owl-bg); border: 1px solid var(--owl-border);
}
.brand-mark .owl .eyes, .brand-mark .owl .glint { animation: none; }
.status {
  margin-left: auto; min-width: 0; display: flex; align-items: center; gap: 6px;
  padding: 3px 4px 3px 9px; border-radius: 999px; background: var(--bg-soft);
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--fg-muted); flex: none; }
.dot.ready { background: var(--ok); }
.dot.connecting { background: var(--warn); animation: pulse 1s ease-in-out infinite; }
.dot.offline { background: var(--err); }
.status-text { font-size: 12px; color: var(--fg-muted); white-space: nowrap; }
.where {
  font-size: 11px; font-weight: 600; color: var(--accent); background: var(--accent-soft);
  padding: 1px 7px; border-radius: 999px; white-space: nowrap;
}
.model {
  max-width: 150px; min-width: 0; border: none; background: transparent; font-size: 12px;
  padding: 2px 2px; text-overflow: ellipsis; border-radius: 6px;
}
.model:hover { background: var(--bg-hover); }
.icon-btn {
  width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent;
  display: grid; place-items: center; color: var(--fg-muted); flex: none;
}
.icon-btn:hover { background: var(--bg-hover); color: var(--fg); }

.menu {
  position: absolute; top: 44px; right: 10px; z-index: 2; min-width: 210px; padding: 5px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow);
}
.menu button {
  display: block; width: 100%; text-align: left; border: none; background: none;
  padding: 7px 10px; border-radius: 6px;
}
.menu button:hover { background: var(--bg-soft); }

.actions { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--border); }
.chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px;
  border: 1px solid var(--border); border-radius: 999px; background: var(--bg); font-size: 13px; font-weight: 500;
}
.chip svg { width: 15px; height: 15px; color: var(--accent); }
.chip:hover:not(:disabled) { background: var(--accent-soft); border-color: var(--accent); }
.chip.active { background: var(--accent-soft); border-color: var(--accent); }

.thread { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
.empty { margin: auto 0; color: var(--fg-muted); font-size: 13px; text-align: center; padding: 0 12px; }
.empty strong { display: block; color: var(--fg); font-size: 15px; margin-bottom: 4px; }
.empty ul { text-align: left; margin: 12px auto 0; padding-left: 18px; max-width: 270px; }

.msg { max-width: 100%; overflow-wrap: anywhere; }
.msg.user {
  align-self: flex-end; max-width: 85%; padding: 8px 12px; border-radius: 14px 14px 4px 14px;
  background: var(--accent); color: var(--accent-fg); white-space: pre-wrap;
}
.msg.assistant { align-self: stretch; }
.msg.assistant > :first-child { margin-top: 0; }
.msg.assistant > :last-child { margin-bottom: 0; }
.msg p, .msg ul, .msg ol, .msg pre { margin: 0 0 8px; }
.msg ul, .msg ol { padding-left: 20px; }
.msg li { margin: 2px 0; }
.msg h3, .msg h4, .msg h5, .msg h6 { margin: 12px 0 4px; font-size: 14px; }
.msg code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: var(--bg-soft); padding: 1px 4px; border-radius: 4px; }
.msg pre { background: var(--bg-soft); padding: 10px; border-radius: 8px; overflow-x: auto; }
.msg pre code { background: none; padding: 0; }
.msg a { color: var(--accent); }
.typing { color: var(--fg-muted); font-size: 13px; display: inline-flex; gap: 6px; align-items: center; }
.typing::before {
  content: ""; width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--border); border-top-color: var(--accent); animation: spin 0.8s linear infinite;
}

.card { border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px; background: var(--bg-soft); font-size: 13px; }
.card.error { border-color: color-mix(in srgb, var(--err) 45%, var(--border)); }
.card-title { font-weight: 600; display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.card-title svg { width: 16px; height: 16px; }
.card.error .card-title svg { color: var(--err); }
.card.ok .card-title svg { color: var(--ok); }
.card p { margin: 4px 0 0; color: var(--fg-muted); }
.card pre { margin: 8px 0 0; white-space: pre-wrap; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--fg); }
.card-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.card-actions button { border: 1px solid var(--border); background: var(--bg); border-radius: 8px; padding: 4px 10px; font-size: 12.5px; }
.card-actions button:hover { border-color: var(--accent); }
.tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.tag { font-size: 11.5px; padding: 1px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
.progress { height: 4px; border-radius: 4px; background: var(--border); margin-top: 8px; overflow: hidden; }
.progress > div { height: 100%; background: var(--accent); width: 0; transition: width 0.2s ease; }

/* Site toolbar (e.g. X): page label and option toggles */
.site-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-soft); font-size: 12.5px; }
.site-label { font-weight: 600; margin-right: auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%; }
.toggle { display: inline-flex; align-items: center; gap: 6px; padding: 3px 9px 3px 4px; border: 1px solid var(--border); border-radius: 999px; background: var(--bg); font-size: 12px; font-weight: 500; }
.toggle::before { content: ""; width: 22px; height: 13px; border-radius: 999px; background: var(--border); box-shadow: inset -9px 0 0 2px var(--bg); transition: background 0.15s, box-shadow 0.15s; }
.toggle[aria-pressed="true"] { border-color: var(--accent); }
.toggle[aria-pressed="true"]::before { background: var(--accent); box-shadow: inset 9px 0 0 2px var(--bg); }

/* Model suggestions */
.recs { display: grid; gap: 6px; margin-top: 8px; }
.rec { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 9px; background: var(--bg); }
.rec b { font-size: 12.5px; }
.rec small { display: block; color: var(--fg-muted); font-size: 11.5px; }
.rec button { margin-left: auto; border: 1px solid var(--border); background: var(--bg-soft); border-radius: 7px; padding: 3px 9px; font-size: 12px; }
.rec button:hover { border-color: var(--accent); }
.cached { font-size: 12px; color: var(--fg-muted); display: flex; align-items: center; gap: 8px; }
.cached button { border: none; background: none; color: var(--accent); padding: 0; font-size: 12px; text-decoration: underline; }

.composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--border); }
.composer textarea {
  flex: 1; resize: none; min-height: 38px; max-height: 140px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 12px; background: var(--bg-soft); outline: none;
}
.composer textarea:focus { border-color: var(--accent); background: var(--bg); }
.send {
  width: 38px; height: 38px; border-radius: 12px; border: none; display: grid; place-items: center;
  background: var(--accent); color: var(--accent-fg);
}
.send.stop { background: var(--fg); color: var(--bg); }

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 50% { opacity: 0.35; } }
@keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 96% { transform: scaleY(0.08); } }
@keyframes watch { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-2.5px); } 45% { transform: translateX(3px); } 70% { transform: translate(1px, 1.5px); } }
@keyframes scan { 0%, 100% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
@keyframes flap-l { from { transform: rotate(8deg); } to { transform: rotate(38deg); } }
@keyframes flap-r { from { transform: rotate(-8deg); } to { transform: rotate(-38deg); } }
@keyframes land { 0% { transform: translateY(-5px) scale(1.06, 0.94); } 45% { transform: translateY(1px) scale(0.94, 1.06); } 75% { transform: translateY(-1px) scale(1.02, 0.98); } 100% { transform: none; } }
@keyframes perk { 0% { transform: rotate(0) scale(1); } 35% { transform: rotate(-9deg) scale(1.08); } 70% { transform: rotate(4deg) scale(1); } 100% { transform: rotate(0) scale(1); } }
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

  // Applied to the page itself (outside the shadow root): site filters such as X's "Verified only".
  SoroAgent.PAGE_CSS = `
[data-soroagent-filtered] { display: none !important; }
`;
})(globalThis);
