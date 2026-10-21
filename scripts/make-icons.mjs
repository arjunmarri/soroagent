// Renders the toolbar/store icons as PNGs with no dependencies: node scripts/make-icons.mjs
// The SoroAgent owl: a white outline on a translucent dark circle, matching the on-page button
// (the same geometry as the OWL svg in extension/content/assistant.js).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const OUT_DIR = fileURLToPath(new URL('../extension/icons/', import.meta.url));
const SIZES = [16, 32, 48, 128];
const BACKGROUND = { rgb: [18, 18, 22], alpha: 0.72 }; // translucent glass
const INK = [255, 255, 255];
const OWL_SCALE = 0.86; // keep the ear tufts inside the circle

// ---------------------------------------------------------------------------
// Owl geometry on a 24-unit grid. Quadratic curves are flattened into polylines.
// ---------------------------------------------------------------------------

function quad(p0, c, p1, steps = 16) {
  const out = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    out.push([
      (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p1[0],
      (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p1[1],
    ]);
  }
  return out;
}

// M5.5 3.5 6.2 8.2Q4.8 10.5 5.2 13.5Q6 19.5 12 20.5Q18 19.5 18.8 13.5Q19.2 10.5 17.8 8.2L18.5 3.5 15 6.2Q12 5.2 9 6.2Z
const body = [
  [5.5, 3.5],
  [6.2, 8.2],
  ...quad([6.2, 8.2], [4.8, 10.5], [5.2, 13.5]),
  ...quad([5.2, 13.5], [6, 19.5], [12, 20.5]),
  ...quad([12, 20.5], [18, 19.5], [18.8, 13.5]),
  ...quad([18.8, 13.5], [19.2, 10.5], [17.8, 8.2]),
  [18.5, 3.5],
  [15, 6.2],
  ...quad([15, 6.2], [12, 5.2], [9, 6.2]),
  [5.5, 3.5],
];
const beak = [[11.2, 13.2], [12, 14.6], [12.8, 13.2]];
// Folded wings: M7.6 13.6q.7 3 3.4 4.6  and  M16.4 13.6q-.7 3-3.4 4.6
const wings = [
  [[7.6, 13.6], ...quad([7.6, 13.6], [8.3, 16.6], [11, 18.2], 10)],
  [[16.4, 13.6], ...quad([16.4, 13.6], [15.7, 16.6], [13, 18.2], 10)],
];
const EYES = [[9.2, 10.6], [14.8, 10.6]];

function segments(points) {
  const out = [];
  for (let i = 1; i < points.length; i++) out.push([points[i - 1], points[i]]);
  return out;
}

function distanceToSegment(x, y, [[x1, y1], [x2, y2]]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function owlCovers(x, y, size) {
  // Thicker strokes at small sizes so the outline stays readable.
  const half = (size <= 16 ? 2.3 : size <= 32 ? 1.7 : size <= 48 ? 1.4 : 1.15) / 2;
  const lines = [...segments(body), ...(size >= 32 ? [...segments(beak), ...wings.flatMap(segments)] : [])];
  if (lines.some((segment) => distanceToSegment(x, y, segment) <= half)) return true;
  const pupil = size <= 16 ? 1.2 : 0.9;
  for (const [cx, cy] of EYES) {
    const d = Math.hypot(x - cx, y - cy);
    if (Math.abs(d - 2.3) <= half || d <= pupil) return true;
  }
  return false;
}

function render(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bg = 0;
      let ink = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = ((px + (sx + 0.5) / samples) / size) * 24;
          const y = ((py + (sy + 0.5) / samples) / size) * 24;
          if (Math.hypot(x - 12, y - 12) > 11.6) continue; // circle
          bg++;
          const ox = 12 + (x - 12) / OWL_SCALE;
          const oy = 12 + (y - 12) / OWL_SCALE;
          if (owlCovers(ox, oy, size)) ink++;
        }
      }
      const total = samples * samples;
      const inkShare = bg ? ink / bg : 0;
      // Composite white ink over the translucent background within the circle.
      const alpha = (bg / total) * (BACKGROUND.alpha + (1 - BACKGROUND.alpha) * inkShare);
      const o = (py * size + px) * 4;
      for (let i = 0; i < 3; i++) {
        const value = alpha ? (BACKGROUND.rgb[i] * BACKGROUND.alpha * (1 - inkShare) + INK[i] * inkShare) / (BACKGROUND.alpha * (1 - inkShare) + inkShare) : 0;
        pixels[o + i] = Math.round(value);
      }
      pixels[o + 3] = Math.round(alpha * 255);
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

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) writeFileSync(join(OUT_DIR, `icon-${size}.png`), render(size));
console.log(`Wrote ${SIZES.length} icons to extension/icons/`);
