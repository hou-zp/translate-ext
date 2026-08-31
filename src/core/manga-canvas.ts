import type { MangaRegion } from './messaging';

/**
 * Repaint a comic image: erase each detected text region (filled with the
 * sampled local background color) and draw the translation inside the same
 * box. Runs in the background service worker via OffscreenCanvas.
 */

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * Sample the ring of pixels just outside a region and return the dominant
 * color. Speech-bubble interiors are usually flat, so the ring right around
 * the text is a good estimate of the fill needed to "erase" it.
 */
function sampleRingColor(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  imgW: number,
  imgH: number,
): { r: number; g: number; b: number } {
  const pad = 3;
  const points: [number, number][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const fx = x + (w * i) / steps;
    points.push([fx, y - pad], [fx, y + h + pad]);
  }
  for (let i = 0; i <= steps; i++) {
    const fy = y + (h * i) / steps;
    points.push([x - pad, fy], [x + w + pad, fy]);
  }
  const samples: [number, number, number][] = [];
  for (const [px, py] of points) {
    const cx = Math.round(Math.min(imgW - 1, Math.max(0, px)));
    const cy = Math.round(Math.min(imgH - 1, Math.max(0, py)));
    const d = ctx.getImageData(cx, cy, 1, 1).data;
    samples.push([d[0] ?? 255, d[1] ?? 255, d[2] ?? 255]);
  }
  // median per channel resists dark bubble outlines in the sample set
  const median = (idx: number) => {
    const vals = samples.map((s) => s[idx] ?? 255).sort((a, b) => a - b);
    return vals[Math.floor(vals.length / 2)] ?? 255;
  };
  return { r: median(0), g: median(1), b: median(2) };
}

/** Greedy line wrap that breaks CJK per character and Latin per word. */
function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const tokens = text.match(/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]|\S+|\s+/g) ?? [text];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) && line === '') continue;
    const candidate = line + tok;
    if (line !== '' && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line.trimEnd());
      line = /^\s+$/.test(tok) ? '' : tok;
    } else {
      line = candidate;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** Find the largest font size whose wrapped text fits the box. */
function layoutText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  boxW: number,
  boxH: number,
): { size: number; lines: string[]; lineHeight: number } {
  const MAX_SIZE = Math.min(28, Math.floor(boxH * 0.8));
  const MIN_SIZE = 9;
  for (let size = Math.max(MIN_SIZE, MAX_SIZE); size >= MIN_SIZE; size--) {
    ctx.font = `500 ${size}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
    const lineHeight = Math.ceil(size * 1.22);
    const lines = wrapText(ctx, text, boxW);
    const fitsW = lines.every((l) => ctx.measureText(l).width <= boxW + 1);
    if (fitsW && lines.length * lineHeight <= boxH + 2) return { size, lines, lineHeight };
  }
  ctx.font = `500 ${MIN_SIZE}px system-ui, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const lineHeight = Math.ceil(MIN_SIZE * 1.22);
  return { size: MIN_SIZE, lines: wrapText(ctx, text, boxW), lineHeight };
}

export async function renderMangaImage(
  imageDataUrl: string,
  regions: MangaRegion[],
): Promise<string> {
  const blob = await (await fetch(imageDataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  for (const region of regions) {
    const x = Math.max(0, Math.round(region.x * width));
    const y = Math.max(0, Math.round(region.y * height));
    const w = Math.min(width - x, Math.round(region.w * width));
    const h = Math.min(height - y, Math.round(region.h * height));
    if (w < 8 || h < 8 || !region.translation.trim()) continue;

    const bg = sampleRingColor(ctx, x, y, w, h, width, height);
    const luminance = 0.299 * bg.r + 0.587 * bg.g + 0.114 * bg.b;
    const textColor = luminance > 140 ? '#111111' : '#f5f5f5';

    // erase: slightly expanded rounded rect in the sampled background color
    const grow = Math.min(6, Math.floor(Math.min(w, h) * 0.08));
    ctx.fillStyle = `rgb(${bg.r},${bg.g},${bg.b})`;
    ctx.beginPath();
    ctx.roundRect(x - grow, y - grow, w + grow * 2, h + grow * 2, 6);
    ctx.fill();

    // repaint: centered translation, auto-sized to fit
    const padX = Math.max(2, Math.floor(w * 0.04));
    const { lines, lineHeight } = layoutText(ctx, region.translation.trim(), w - padX * 2, h);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const totalH = lines.length * lineHeight;
    const startY = y + Math.max(lineHeight / 2, (h - totalH) / 2 + lineHeight / 2);
    lines.forEach((line, i) => {
      ctx.fillText(line, x + w / 2, startY + i * lineHeight, w - padX);
    });
  }

  const out = await canvas.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await out.arrayBuffer());
  return `data:image/png;base64,${bytesToBase64(bytes)}`;
}

/** Parse + validate the vision model's region JSON. Returns null when unusable. */
export function parseMangaRegions(raw: string): MangaRegion[] | null {
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const regions: MangaRegion[] = [];
  for (const item of data) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const nums = [r.x, r.y, r.w, r.h].map((v) => (typeof v === 'number' ? v : NaN));
    const [x, y, w, h] = nums as [number, number, number, number];
    if (nums.some((n) => !Number.isFinite(n))) continue;
    if (x < 0 || y < 0 || x >= 1 || y >= 1 || w <= 0 || h <= 0) continue;
    const text = typeof r.text === 'string' ? r.text : '';
    const translation = typeof r.translation === 'string' ? r.translation.trim() : '';
    if (!translation) continue;
    regions.push({
      x,
      y,
      w: Math.min(w, 1 - x),
      h: Math.min(h, 1 - y),
      text,
      translation,
    });
  }
  return regions;
}
