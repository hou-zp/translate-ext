import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PdfPageData } from './pdf';

/**
 * Bilingual PDF export (BabelDOC-style "alternating dual" mode): every
 * original page is followed by a generated translation page whose paragraphs
 * sit at the same positions as in the original.
 */

const CJK_FONT_URL =
  'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf';
const FONT_CACHE = 'txe-fonts-v1';

/** Download the CJK font once; later exports hit the Cache API copy. */
export async function fetchCjkFont(
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(CJK_FONT_URL);
  if (hit) return hit.arrayBuffer();
  const res = await fetch(CJK_FONT_URL);
  if (!res.ok) throw new Error(`字体下载失败 HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  if (onProgress && res.body) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(loaded, total);
    }
    const buf = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) {
      buf.set(c, off);
      off += c.length;
    }
    await cache.put(CJK_FONT_URL, new Response(buf.slice().buffer));
    return buf.buffer;
  }
  const buf = await res.arrayBuffer();
  await cache.put(CJK_FONT_URL, new Response(buf.slice(0)));
  return buf;
}

function needsCjk(text: string): boolean {
  return /[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/.test(text);
}

/** Greedy wrap using real font metrics; CJK breaks per char, Latin per word. */
function wrapForFont(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const tokens = text.match(/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]|\S+|\s+/g) ?? [text];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) && line === '') continue;
    const candidate = line + tok;
    if (line !== '' && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line.trimEnd());
      line = /^\s+$/.test(tok) ? '' : tok;
    } else {
      line = candidate;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

/** Draw text inside a box, shrinking font size / line height until it fits. */
function drawTextInBox(
  page: PDFPage,
  font: PDFFont,
  text: string,
  box: { x: number; yTop: number; w: number; h: number },
): void {
  const MAX = 14;
  const MIN = 5;
  let chosen: { size: number; lines: string[]; lineHeight: number } | null = null;
  for (let size = MAX; size >= MIN; size -= 0.5) {
    const lineHeight = size * 1.3;
    const lines = wrapForFont(font, text, size, box.w);
    if (lines.length * lineHeight <= box.h + 2) {
      chosen = { size, lines, lineHeight };
      break;
    }
  }
  if (!chosen) {
    const size = MIN;
    chosen = { size, lines: wrapForFont(font, text, size, box.w), lineHeight: size * 1.15 };
  }
  let y = box.yTop - chosen.size;
  for (const line of chosen.lines) {
    if (y < box.yTop - box.h - chosen.lineHeight) break; // clip hard overflow
    page.drawText(line, {
      x: box.x,
      y,
      size: chosen.size,
      font,
      color: rgb(0.07, 0.09, 0.15),
    });
    y -= chosen.lineHeight;
  }
}

export interface BilingualExportInput {
  /** original PDF bytes */
  original: ArrayBuffer;
  /** parsed page layouts (same indexes as the original document) */
  pages: PdfPageData[];
  /** restored translation for a paragraph, or null when missing */
  translationFor: (pageIndex: number, paraIndex: number) => string | null;
  /** whole-page translation for scanned pages (OCR result) */
  pageFallback?: (pageIndex: number) => string | null;
  /** Noto Sans SC bytes; required when any translation contains CJK */
  cjkFont?: ArrayBuffer;
}

/** Build an alternating original/translation PDF. */
export async function exportBilingualPdf(input: BilingualExportInput): Promise<Uint8Array> {
  const src = await PDFDocument.load(input.original, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);

  const anyCjk = input.pages.some((p) =>
    p.paragraphs.some((_, i) => needsCjk(input.translationFor(p.pageIndex, i) ?? '')),
  );
  let font: PDFFont;
  if (anyCjk || input.pages.some((p) => needsCjk(input.pageFallback?.(p.pageIndex) ?? ''))) {
    if (!input.cjkFont) throw new Error('译文包含中日韩字符，需要先下载 CJK 字体');
    font = await out.embedFont(input.cjkFont, { subset: true });
  } else {
    font = await out.embedFont(StandardFonts.Helvetica);
  }

  const pageByIndex = new Map(input.pages.map((p) => [p.pageIndex, p]));

  for (let i = 0; i < src.getPageCount(); i++) {
    const [copied] = await out.copyPages(src, [i]);
    if (copied) out.addPage(copied);

    const layout = pageByIndex.get(i);
    const srcPage = src.getPage(i);
    const { width, height } = srcPage.getSize();
    const transPage = out.addPage([width, height]);

    let drewAnything = false;
    if (layout) {
      layout.paragraphs.forEach((para, j) => {
        const tr = input.translationFor(i, j);
        if (!tr) return;
        drewAnything = true;
        drawTextInBox(transPage, font, tr, {
          x: para.left * width,
          yTop: (1 - para.top) * height,
          w: Math.max(40, para.width * width),
          h: Math.max(12, para.height * height),
        });
      });
    }
    const fallback = input.pageFallback?.(i);
    if (!drewAnything && fallback) {
      drawTextInBox(transPage, font, fallback, {
        x: width * 0.08,
        yTop: height * 0.92,
        w: width * 0.84,
        h: height * 0.84,
      });
      drewAnything = true;
    }
    if (!drewAnything) {
      transPage.drawText('(no translation)', {
        x: width * 0.08,
        y: height * 0.9,
        size: 10,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  return out.save();
}

/** Trigger a client-side download for binary data. */
export function downloadBytes(filename: string, data: Uint8Array, mime = 'application/pdf'): void {
  const copy = new Uint8Array(data);
  const blob = new Blob([copy.buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
