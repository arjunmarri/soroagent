// The SoroAgent owl: one definition used for the on-page button (SVG) and the toolbar/store
// icons (PNGs rendered by scripts/make-icons.mjs). A mint owl perched on a branch, drawn with
// filled shapes only (no thin outlines) so it stays readable at 16px.
(function (root) {
  'use strict';

  const SoroAgent = (root.SoroAgent = root.SoroAgent || {});

  const PALETTE = Object.freeze({
    body: '#34D399',
    wing: '#28A477', // body, 22% darker
    belly: '#7AE3BE', // body, 35% lighter
    eye: '#0A0A0C',
    glint: '#FFFFFF',
    beak: '#FDE68A',
    mouth: '#064E3B',
    feet: '#F59E0B',
    branch: '#7C5A3A',
    bgLight: '#FFFFFF',
    bgDark: '#111113',
    borderLight: '#E4E4E7',
    borderDark: '#2A2A2E',
  });

  // Shapes on a 128 grid, painted in order. `cls` and `group` name parts the on-page button
  // animates: the eyes blink, the glints follow the cursor, the wings flap in flight.
  const SHAPES = Object.freeze([
    { type: 'path', fill: 'body', d: 'M42 40 L37 19 L54 31 Q64 28 74 31 L91 19 L86 40 Q95 50 95 66 Q99 82 93 94 Q85 107 64 107 Q43 107 35 94 Q29 82 33 66 Q33 50 42 40 Z' },
    { type: 'ellipse', fill: 'belly', cx: 64, cy: 88, rx: 17, ry: 16 },
    { type: 'path', fill: 'wing', cls: 'wing wing-l', d: 'M35 66 Q24 84 37 104 Q46 92 45 76 Q42 69 35 66 Z' },
    { type: 'path', fill: 'wing', cls: 'wing wing-r', d: 'M93 66 Q104 84 91 104 Q82 92 83 76 Q86 69 93 66 Z' },
    { type: 'circle', fill: 'eye', group: 'eyes', cx: 51, cy: 55, r: 14.5 },
    { type: 'circle', fill: 'eye', group: 'eyes', cx: 77, cy: 55, r: 14.5 },
    { type: 'circle', fill: 'glint', group: 'eyes', cls: 'glint', cx: 56, cy: 50, r: 4.6 },
    { type: 'circle', fill: 'glint', group: 'eyes', cls: 'glint', cx: 82, cy: 50, r: 4.6 },
    { type: 'path', fill: 'beak', stroke: 'beak', width: 3, d: 'M59.5 68 L68.5 68 L64 74.5 Z' },
    { type: 'line', stroke: 'mouth', width: 3, d: 'M59 80 Q64 84 69 80' },
    { type: 'rect', fill: 'branch', x: 24, y: 109, w: 80, h: 6, r: 3 },
    ...[51, 55, 59, 69, 73, 77].map((x) => ({ type: 'line', stroke: 'feet', width: 3.6, d: `M${x} 106 L${x} 112` })),
  ]);

  // How the bird (y 19–115) sits in each frame.
  const FIT = Object.freeze({
    tile: { cx: 64, cy: 64, scale: 1.04, ox: 64, oy: 67 },
    circle: { cx: 64, cy: 66, scale: 0.94, ox: 64, oy: 67 },
  });

  /** SVG markup. opts: { theme: 'light' | 'dark', frame: 'tile' | 'circle', className, background: true } */
  function owlSvg({ theme = 'light', frame = 'tile', className = 'owl', background = true } = {}) {
    const p = PALETTE;
    const f = FIT[frame];
    const shape = frame === 'circle' ? '<circle cx="64" cy="64" r="64"/>' : '<rect width="128" height="128" rx="30"/>';
    let parts = '';
    let open = '';
    for (const s of SHAPES) {
      const group = s.group || '';
      if (group !== open) {
        if (open) parts += '</g>';
        if (group) parts += `<g class="${group}">`;
        open = group;
      }
      parts += shapeSvg(s);
    }
    if (open) parts += '</g>';
    function shapeSvg(s) {
      const cls = s.cls ? ` class="${s.cls}"` : '';
      const fill = s.fill ? p[s.fill] : 'none';
      const stroke = s.stroke ? ` stroke="${p[s.stroke]}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"` : '';
      if (s.type === 'circle') return `<circle${cls} cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${fill}"/>`;
      if (s.type === 'ellipse') return `<ellipse${cls} cx="${s.cx}" cy="${s.cy}" rx="${s.rx}" ry="${s.ry}" fill="${fill}"/>`;
      if (s.type === 'rect') return `<rect${cls} x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r}" fill="${fill}"/>`;
      return `<path${cls} d="${s.d}" fill="${fill}"${stroke}/>`;
    }
    const bg = background ? `<g fill="${theme === 'dark' ? p.bgDark : p.bgLight}">${shape}</g>` : '';
    const id = `soroagent-owl-${frame}`;
    return (
      `<svg class="${className}" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
      `<defs><clipPath id="${id}">${shape}</clipPath></defs><g clip-path="url(#${id})">${bg}` +
      `<g class="bird" transform="translate(${f.cx} ${f.cy}) scale(${f.scale}) translate(${-f.ox} ${-f.oy})">` +
      `${parts}</g></g></svg>`
    );
  }

  Object.assign(SoroAgent, { BRAND: { PALETTE, SHAPES, FIT, owlSvg } });
})(globalThis);
