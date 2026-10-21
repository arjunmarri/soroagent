// Renders the toolbar/store icons from the owl in extension/shared/brand.js, with no dependencies:
//   node scripts/make-icons.mjs
// Writes extension/icons/icon-<size>.png (light theme: white tile) and
// extension/icons/dark/icon-<size>.png (dark theme: near-black tile).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT_DIR = join(ROOT, 'extension/icons');
const SIZES = [16, 32, 48, 128];

await import(pathToFileURL(join(ROOT, 'extension/shared/brand.js')).href);
const { PALETTE, SHAPES, FIT } = globalThis.soroagent.BRAND;

// ---------------------------------------------------------------------------
// Geometry: a tiny renderer for the shapes brand.js uses (M/L/Q/Z paths, circles,
// ellipses, rounded rects, round-capped strokes).
// ---------------------------------------------------------------------------

function parsePath(d) {
  const tokens = d.match(/[MLQZ]|-?\d*\.?\d+/g);
  const subpaths = [];
  let points = [];
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => Number(tokens.shift());
  while (tokens.length) {
    if (/[MLQZ]/.test(tokens[0])) cmd = tokens.shift();
    if (cmd === 'M') {
      if (points.length) subpaths.push(points);
      x = num();
      y = num();
      points = [[x, y]];
      cmd = 'L'; // implicit lineto after moveto
    } else if (cmd === 'L') {
      x = num();
      y = num();
      points.push([x, y]);
    } else if (cmd === 'Q') {
      const cx = num();
      const cy = num();
      const ex = num();
      const ey = num();
      for (let i = 1; i <= 12; i++) {
        const t = i / 12;
        points.push([(1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t ** 2 * ex, (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t ** 2 * ey]);
      }
      x = ex;
      y = ey;
    } else if (cmd === 'Z') {
      if (points.length) points.push(points[0]);
      subpaths.push(points);
      points = [];
      cmd = '';
    }
  }
  if (points.length) subpaths.push(points);
  return subpaths;
}

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function nearPolyline(x, y, poly, half) {
  for (let i = 1; i < poly.length; i++) {
    const [x1, y1] = poly[i - 1];
    const [x2, y2] = poly[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
    if (Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)) <= half) return true;
  }
  return false;
}

function inRoundedRect(x, y, rx, ry, w, h, r) {
  const cx = Math.min(Math.max(x, rx + r), rx + w - r);
  const cy = Math.min(Math.max(y, ry + r), ry + h - r);
  return x >= rx && x <= rx + w && y >= ry && y <= ry + h && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Pre-compute paths once; return a hit test per shape (in bird coordinates).
const painters = SHAPES.map((s) => {
  if (s.type === 'circle') return { color: s.fill, hit: (x, y) => (x - s.cx) ** 2 + (y - s.cy) ** 2 <= s.r ** 2 };
  if (s.type === 'ellipse') return { color: s.fill, hit: (x, y) => ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1 };
  if (s.type === 'rect') return { color: s.fill, hit: (x, y) => inRoundedRect(x, y, s.x, s.y, s.w, s.h, s.r) };
  const polys = parsePath(s.d);
  if (s.type === 'line') return { color: s.stroke, hit: (x, y, boost) => polys.some((p) => nearPolyline(x, y, p, (s.width * boost) / 2)) };
  return {
    color: s.fill,
    hit: (x, y, boost) => polys.some((p) => inPolygon(x, y, p) || (s.stroke && nearPolyline(x, y, p, (s.width * boost) / 2))),
  };
});

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function render(size, theme) {
  const fit = FIT.tile;
  const bg = rgb(theme === 'dark' ? PALETTE.bgDark : PALETTE.bgLight);
  const border = rgb(theme === 'dark' ? PALETTE.borderDark : PALETTE.borderLight);
  const boost = size <= 16 ? 1.6 : size <= 32 ? 1.25 : 1; // thicker strokes when tiny
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = ((px + (sx + 0.5) / samples) / size) * 128;
          const y = ((py + (sy + 0.5) / samples) / size) * 128;
          if (!inRoundedRect(x, y, 0, 0, 128, 128, 30)) continue;
          covered++;
          let color = inRoundedRect(x, y, 2, 2, 124, 124, 28) ? bg : border;
          // Map the sample into the bird's coordinates and paint shapes in order.
          const bx = (x - fit.cx) / fit.scale + fit.ox;
          const by = (y - fit.cy) / fit.scale + fit.oy;
          for (const painter of painters) if (painter.hit(bx, by, boost)) color = rgb(PALETTE[painter.color]);
          r += color[0];
          g += color[1];
          b += color[2];
        }
      }
      const o = (py * size + px) * 4;
      if (covered) {
        pixels[o] = Math.round(r / covered);
        pixels[o + 1] = Math.round(g / covered);
        pixels[o + 2] = Math.round(b / covered);
      }
      pixels[o + 3] = Math.round((covered / (samples * samples)) * 255);
    }
  }
  return encodePng(size, pixels);
}

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(join(OUT_DIR, 'dark'), { recursive: true });
for (const size of SIZES) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), render(size, 'light'));
  writeFileSync(join(OUT_DIR, 'dark', `icon-${size}.png`), render(size, 'dark'));
}
console.log(`Wrote ${SIZES.length * 2} icons to extension/icons/ (light) and extension/icons/dark/`);
