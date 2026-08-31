import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** A clustered paragraph in PDF user space, with a bbox normalized to page size (0..1). */
export interface PdfParagraph {
  text: string;
  /** normalized bbox, origin top-left */
  left: number;
  top: number;
  width: number;
  height: number;
  lineCount: number;
}

export interface PdfPageData {
  pageIndex: number;
  /** page size in PDF units at scale 1 */
  pageWidth: number;
  pageHeight: number;
  paragraphs: PdfParagraph[];
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data }).promise;
}

export async function renderPageToCanvas(
  doc: PDFDocumentProxy,
  pageIndex: number,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): Promise<void> {
  const page = await doc.getPage(pageIndex + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = cssWidth / base.width;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
}

interface Line {
  y: number; // baseline y (pdf space, origin bottom-left)
  x0: number;
  x1: number;
  height: number;
  text: string;
}

/**
 * Extract text items from a page and cluster them into paragraphs:
 * items -> lines (by y proximity) -> paragraphs (by vertical gap and indent).
 */
export async function extractPageParagraphs(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<PdfPageData> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  interface Item {
    x: number;
    y: number;
    w: number;
    h: number;
    str: string;
  }
  const items: Item[] = [];
  for (const raw of content.items) {
    const it = raw as { str?: string; transform?: number[]; width?: number; height?: number };
    if (!it.str || !it.transform) continue;
    if (it.str.trim().length === 0) continue;
    const a = it.transform[0] ?? 0;
    const b = it.transform[1] ?? 0;
    const e = it.transform[4] ?? 0;
    const f = it.transform[5] ?? 0;
    const fontH = Math.hypot(a, b) || it.height || 10;
    items.push({ x: e, y: f, w: it.width ?? 0, h: fontH, str: it.str });
  }

  // group items into lines by y proximity
  items.sort((p, q) => q.y - p.y || p.x - q.x);
  const lines: Line[] = [];
  for (const it of items) {
    const tol = Math.max(2, it.h * 0.45);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) {
      // keep natural reading order within the line
      if (it.x >= line.x1 - 1) {
        const gap = it.x - line.x1;
        line.text += gap > it.h * 0.3 ? ` ${it.str}` : it.str;
      } else {
        line.text = `${it.str} ${line.text}`;
        line.x0 = Math.min(line.x0, it.x);
      }
      line.x1 = Math.max(line.x1, it.x + it.w);
      line.height = Math.max(line.height, it.h);
    } else {
      lines.push({ y: it.y, x0: it.x, x1: it.x + it.w, height: it.h, text: it.str });
    }
  }
  lines.sort((p, q) => q.y - p.y);

  // merge lines into paragraphs
  const paragraphs: PdfParagraph[] = [];
  let group: Line[] = [];
  const flush = () => {
    if (group.length === 0) return;
    const text = group
      .map((l) => l.text.trim())
      .join(' ')
      .replace(/-\s+/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length >= 2) {
      const x0 = Math.min(...group.map((l) => l.x0));
      const x1 = Math.max(...group.map((l) => l.x1));
      const yTop = Math.max(...group.map((l) => l.y + l.height));
      const lastLine = group[group.length - 1]!;
      const yBottom = Math.min(...group.map((l) => l.y)) - lastLine.height * 0.25;
      paragraphs.push({
        text,
        left: Math.max(0, x0 / viewport.width),
        top: Math.max(0, (viewport.height - yTop) / viewport.height),
        width: Math.min(1, (x1 - x0) / viewport.width),
        height: Math.min(1, (yTop - yBottom) / viewport.height),
        lineCount: group.length,
      });
    }
    group = [];
  };

  for (const line of lines) {
    if (group.length === 0) {
      group.push(line);
      continue;
    }
    const prev = group[group.length - 1]!;
    const gap = prev.y - line.y;
    const maxGap = Math.max(prev.height, line.height) * 1.7;
    const sameColumn =
      Math.min(prev.x1, line.x1) - Math.max(prev.x0, line.x0) > -10; // horizontal overlap-ish
    if (gap > 0 && gap <= maxGap && sameColumn) {
      group.push(line);
    } else {
      flush();
      group.push(line);
    }
  }
  flush();

  return {
    pageIndex,
    pageWidth: viewport.width,
    pageHeight: viewport.height,
    paragraphs,
  };
}
