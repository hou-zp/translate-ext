// Generates extension icon PNGs without any native canvas dependency:
// hand-rolled PNG encoder (RGBA + zlib deflate) drawing a rounded blue tile
// with a white "text lines + translate arrow" glyph.
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

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const put = (x, y, r, g, b, a) => {
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  const inRounded = (x, y) => {
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return Math.hypot(x - cx, y - cy) <= radius;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!inRounded(x + 0.5, y + 0.5)) {
        put(x, y, 0, 0, 0, 0);
        continue;
      }
      // vertical blue gradient
      const t = y / size;
      const r = Math.round(59 + (37 - 59) * t);
      const g = Math.round(130 + (99 - 130) * t);
      const b = Math.round(246 + (235 - 246) * t);
      put(x, y, r, g, b, 255);
    }
  }
  // white glyph: three "text" bars (top-left) + arrow bar (bottom)
  const bar = (x0, y0, w, h) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) {
      for (let x = Math.round(x0); x < Math.round(x0 + w); x++) {
        if (x >= 0 && x < size && y >= 0 && y < size && inRounded(x + 0.5, y + 0.5)) {
          put(x, y, 255, 255, 255, 235);
        }
      }
    }
  };
  const u = size / 16;
  bar(3.4 * u, 4.0 * u, 9.2 * u, 1.5 * u);
  bar(3.4 * u, 7.2 * u, 6.4 * u, 1.5 * u);
  bar(3.4 * u, 10.4 * u, 7.8 * u, 1.5 * u);
  // arrow head on the middle-right suggesting translation direction
  for (let i = 0; i < 2.6 * u; i++) {
    bar(10.6 * u + i, 7.2 * u + i * 0.55, 1.2 * u, 1.5 * u - i * 0.35);
  }
  return encodePng(size, size, px);
}

mkdirSync(join(root, 'public/icon'), { recursive: true });
for (const size of [16, 32, 48, 96, 128]) {
  writeFileSync(join(root, `public/icon/${size}.png`), drawIcon(size));
  console.log(`icon ${size}x${size} written`);
}
