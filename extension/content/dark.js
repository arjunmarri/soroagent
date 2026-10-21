// Dark mode for sites that don't have one. Runs at document_start so a darkened site never
// flashes white. The page is inverted with a CSS filter on <html> (which, unlike a filter on any
// other element, doesn't break fixed headers), then photos and videos are inverted back so they
// keep their real colours. Brightness, contrast and sepia are adjustable per site and stored in
// settings.darkSites: { [hostname]: { brightness, contrast, sepia } }.
(function (root) {
  'use strict';

  const soroagent = (root.soroagent = root.soroagent || {});
  if (soroagent.dark) return; // injected twice (e.g. after an extension reload)

  const DARK_DEFAULTS = { brightness: 100, contrast: 100, sepia: 0 };
  const LIMITS = { brightness: [50, 150], contrast: [50, 150], sepia: [0, 100] };
  const FLIP = 'invert(1) hue-rotate(180deg)';
  // Media that should keep its real colours (flipped twice = original).
  const MEDIA = 'img, video, canvas, iframe, embed, object, svg image, [style*="background-image"]:not(html, body)';

  /** Pure: clamped, whole-number options with defaults filled in. */
  function normalizeDark(options) {
    const out = {};
    for (const [key, [min, max]] of Object.entries(LIMITS)) {
      const value = Math.round(Number(options && options[key]));
      out[key] = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : DARK_DEFAULTS[key];
    }
    return out;
  }

  /** Pure: the page CSS for dark mode with the given options. */
  function darkCss(options) {
    const o = normalizeDark(options);
    const tune = `brightness(${o.brightness / 100}) contrast(${o.contrast / 100}) sepia(${o.sepia / 100})`;
    return `
html { filter: ${FLIP} ${tune} !important; background-color: #fff !important; color-scheme: light !important; }
:is(${MEDIA}) { filter: ${FLIP} !important; }
[style*="background-image"]:not(html, body) :is(img, video, canvas, iframe) { filter: none !important; }
`;
  }

  const state = { on: false, options: { ...DARK_DEFAULTS }, sheet: null, style: null, listeners: new Set() };

  // soroagent's own button and panel sit inside <html>, so they get flipped back too (set on the
  // shadow host; assistant.js turns it into a filter on the launcher and panel).
  function markHost() {
    const host = root.document && root.document.querySelector('soroagent-assistant');
    if (host) host.toggleAttribute('data-dark', state.on);
  }

  function write(css) {
    const doc = root.document;
    // Constructable sheets are not subject to the page's style-src CSP; fall back to <style>.
    try {
      if (!state.sheet) {
        state.sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, state.sheet];
      }
      state.sheet.replaceSync(css);
      // Some pages replace document.adoptedStyleSheets wholesale; put ours back.
      if (css && !doc.adoptedStyleSheets.includes(state.sheet)) doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, state.sheet];
    } catch {
      if (!state.style) {
        state.style = doc.createElement('style');
        state.style.id = 'soroagent-dark';
      }
      state.style.textContent = css;
      if (!state.style.isConnected) doc.documentElement.append(state.style);
    }
  }

  /** Turns dark mode on with `options`, or off when `options` is null. Only affects this tab. */
  function apply(options) {
    state.on = Boolean(options);
    state.options = normalizeDark(options || state.options);
    // Full-screen videos and slideshows are shown as they are.
    write(state.on && !(root.document && root.document.fullscreenElement) ? darkCss(state.options) : '');
    markHost();
    for (const listener of state.listeners) listener(state.on, state.options);
  }

  const forSite = (settings, host) => {
    const sites = (settings && settings.darkSites) || {};
    return Object.prototype.hasOwnProperty.call(sites, host) ? sites[host] : null;
  };

  soroagent.dark = {
    apply,
    isOn: () => state.on,
    options: () => ({ ...state.options }),
    onChange: (listener) => state.listeners.add(listener),
    markHost,
  };
  Object.assign(soroagent, { DARK_DEFAULTS, normalizeDark, darkCss });

  // In a web page: apply the saved choice for this site straight away and follow changes made in
  // other tabs (or the settings page).
  const ext = root.browser || root.chrome;
  if (!root.document || !root.location || !/^https?:$/.test(root.location.protocol) || !ext || !ext.storage) return;
  const host = root.location.hostname;
  const sync = (settings) => {
    const options = forSite(settings, host);
    if (Boolean(options) !== state.on || (options && darkCss(options) !== darkCss(state.options))) apply(options);
  };
  root.document.addEventListener('fullscreenchange', () => state.on && apply(state.options));
  ext.storage.local.get('settings').then((stored) => sync(stored.settings), () => {});
  ext.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) sync(changes.settings.newValue);
  });
})(globalThis);
