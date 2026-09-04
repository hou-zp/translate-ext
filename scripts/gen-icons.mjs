// Generates extension icon PNGs without any native canvas dependency:
// hand-rolled PNG encoder (RGBA + zlib deflate) drawing the brand mark —
// an ink tile with a bone "文" bubble (speech tail) overlapped by a
// cinnabar-stroked "A" bubble, matching src/content/logo.ts.
// Rasterized in a 40x40 design space with per-pixel supersampling for AA.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, detail) {
  // ---- geometry in a 40x40 design space (same as the SVG mark) ----
  const insideRR = (x, y, x0, y0, x1, y1, r) => {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const dx = Math.max(Math.abs(x - cx) - (x1 - x0) / 2 + r, 0);
    const dy = Math.max(Math.abs(y - cy) - (y1 - y0) / 2 + r, 0);
    return dx * dx + dy * dy <= r * r;
  };
  const seg = (x, y, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
    return Math.hypot(x - (ax + t * vx), y - (ay + t * vy));
  };

  const BONE = [233, 228, 216]; // #e9e4d8
  const CINNABAR = [213, 72, 47]; // #d5482f
  const CINNABAR_HI = [239, 106, 76]; // #ef6a4c
  const INK = [11, 13, 16]; // #0b0d10
  const TILE_TOP = [26, 32, 40]; // #1a2028
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // Painter's algorithm: later layers win; nothing renders outside the tile.
  const sample = (x, y) => {
    let col = null;
    // ink tile with a subtle vertical gradient
    if (insideRR(x, y, 0.5, 0.5, 39.5, 39.5, 8)) col = mix(TILE_TOP, INK, y / 40);
    if (!col) return null;
    // small sizes: just the two bubbles, bolder, no interior glyphs
    if (!detail) {
      if (insideRR(x, y, 3, 4.5, 25.5, 24.5, 5) && !insideRR(x, y, 5.2, 6.7, 23.3, 22.3, 3.6)) col = BONE;
      if (seg(x, y, 9.5, 23.5, 9.5, 28.6) <= 1.7 || seg(x, y, 9.5, 28.6, 14, 23.8) <= 1.7) col = BONE;
      if (insideRR(x, y, 14.5, 16.5, 37.5, 35, 5)) col = CINNABAR;
      return col;
    }
    // 文 bubble: bone ring + speech tail
    const wOut = insideRR(x, y, 3, 4.5, 25.5, 24.5, 5);
    const wIn = insideRR(x, y, 4.7, 6.2, 23.8, 22.8, 3.8);
    if (wOut && !wIn) col = BONE;
    if (seg(x, y, 9.5, 23.5, 9.5, 28.6) <= 1.4 || seg(x, y, 9.5, 28.6, 14, 23.8) <= 1.4) col = BONE;
    // 文 glyph: dot + horizontal + crossing diagonals
    if ((x - 14) ** 2 + (y - 9.4) ** 2 <= 1.6 ** 2) col = BONE;
    if (y >= 11.8 && y <= 14.2 && x >= 7 && x <= 20) col = BONE;
    if (seg(x, y, 14, 14.2, 9.4, 20.8) <= 1.25 || seg(x, y, 14, 14.2, 18.6, 20.8) <= 1.25) col = BONE;
    // A bubble: deep ink fill, cinnabar ring
    if (insideRR(x, y, 14.5, 16.5, 37.5, 35, 5)) col = INK;
    if (insideRR(x, y, 14.5, 16.5, 37.5, 35, 5) && !insideRR(x, y, 16.2, 18.2, 35.8, 33.3, 3.8)) col = CINNABAR;
    // A glyph: two legs + crossbar, in hot cinnabar
    if (seg(x, y, 26, 22.4, 21.8, 31.4) <= 1.3) col = CINNABAR_HI;
    if (seg(x, y, 26, 22.4, 30.2, 31.4) <= 1.3) col = CINNABAR_HI;
    if (y >= 27 && y <= 29.2 && x >= 23.4 && x <= 28.6) col = CINNABAR_HI;
    return col;
  };

  // supersample each pixel n x n for anti-aliasing
  const n = 6;
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxx = 0; pxx < size; pxx++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < n; sy++) {
        for (let sx = 0; sx < n; sx++) {
          const col = sample(
            ((pxx + (sx + 0.5) / n) / size) * 40,
            ((py + (sy + 0.5) / n) / size) * 40,
          );
          if (col) { r += col[0]; g += col[1]; b += col[2]; a++; }
        }
      }
      const i = (py * size + pxx) * 4;
      if (a > 0) {
        px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a);
        px[i + 3] = Math.round((a / (n * n)) * 255);
      }
    }
  }
  return encodePng(size, size, px);
}

mkdirSync(join(root, 'public/icon'), { recursive: true });
for (const size of [16, 32, 48, 96, 128]) {
  writeFileSync(join(root, `public/icon/${size}.png`), drawIcon(size, size > 32));
  console.log(`icon ${size}x${size} written`);
}
