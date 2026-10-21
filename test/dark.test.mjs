import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers.mjs';

const S = await load('content/dark.js');

test('dark mode options are clamped whole numbers with defaults', () => {
  assert.deepEqual(S.normalizeDark(undefined), S.DARK_DEFAULTS);
  assert.deepEqual(S.normalizeDark({ brightness: 300, contrast: 10, sepia: 33.6 }), { brightness: 150, contrast: 50, sepia: 34 });
  assert.deepEqual(S.normalizeDark({ brightness: 'x' }), S.DARK_DEFAULTS);
});

test('dark mode inverts the page, flips media back and applies the tuning', () => {
  const css = S.darkCss({ brightness: 90, contrast: 110, sepia: 20 });
  assert.match(css, /html \{ filter: invert\(1\) hue-rotate\(180deg\) brightness\(0\.9\) contrast\(1\.1\) sepia\(0\.2\)/);
  assert.match(css, /img, video, canvas, iframe/);
  assert.match(css, /\[style\*="background-image"\]:not\(html, body\) :is\(img, video, canvas, iframe\) \{ filter: none/);
});
