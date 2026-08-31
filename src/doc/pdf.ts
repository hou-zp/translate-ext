import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** A clustered paragraph in PDF user space, with a bbox normalized to page size (0..1). */
export interface PdfParagraph {
  /** Paragraph text; protected runs (formulas/code) appear as ⟦n⟧ placeholders. */
  text: string;
  /** Original text of each ⟦n⟧ placeholder, indexed by n. */
  protectedRuns: string[];
  /** true when this paragraph is a single table cell */
  isCell?: boolean;
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

// ---------------------------------------------------------------------------
// Formula / code detection (BabelDOC-style placeholder protection, lightweight)
// ---------------------------------------------------------------------------

/** Math/symbol font names used by TeX and friends. */
const MATH_FONT_RE =
  /CMMI|CMSY|CMEX|CMBSY|MSAM|MSBM|Math|Symbol|EUFM|EUSM|MTMI|MTSY|LASY|STIX|AMS|rsfs|wasy/i;
const MONO_FONT_RE = /Mono|Courier|Consolas|Menlo|CMTT|LMTT|Typewriter|Inconsolata|Source ?Code/i;

const MATH_CHAR_RE =
  /[∑∏∫∮√∞≈≠≤≥≪≫±∓×÷⋅∘∂∇∈∉∋⊂⊃⊆⊇∪∩∧∨¬∀∃⇒⇐⇔→←↔↦⟶∝∼≃≅≡⊕⊗⊥∥∅ℏℓℜℑ⟨⟩αβγδεζηθικλμνξπρςστυφχψωΓΔΘΛΞΠΣΥΦΨΩ]/;

/** Heuristic: is this text item part of an inline formula or code fragment? */
function isProtectedItem(str: string, fontName: string, mono: boolean): boolean {
  if (MATH_FONT_RE.test(fontName)) return true;
  if (mono || MONO_FONT_RE.test(fontName)) return true;
  const trimmed = str.trim();
  if (!trimmed) return false;
  // strings dominated by math symbols / operators
  let mathish = 0;
  for (const ch of trimmed) {
    if (MATH_CHAR_RE.test(ch) || /[=+\-^_{}\\|<>/[\]()0-9]/.test(ch)) mathish++;
  }
  return MATH_CHAR_RE.test(trimmed) && mathish / trimmed.length > 0.6;
}

export const PROTECT_OPEN = '⟦';
export const PROTECT_CLOSE = '⟧';

/** Substitute ⟦n⟧ placeholders back with their original runs (tolerant). */
export function restoreProtectedRuns(text: string, runs: string[]): string {
  if (runs.length === 0) return text;
  return text.replace(/[⟦【]\s*(\d{1,3})\s*[⟧】]/g, (match, num: string) => {
    const idx = Number(num);
    return runs[idx] ?? match;
  });
}

// ---------------------------------------------------------------------------
// Text extraction: items -> lines (w/ table-row splitting) -> paragraphs
// ---------------------------------------------------------------------------

interface Part {
  str: string;
  protected: boolean;
}

interface Seg {
  x0: number;
  x1: number;
  parts: Part[];
}

interface Line {
  y: number; // baseline y (pdf space, origin bottom-left)
  x0: number;
  x1: number;
  height: number;
  segs: Seg[];
}

/** Gap (relative to font height) that separates two table cells on a line. */
const CELL_GAP_FACTOR = 2.5;
/** Minimum segments on a line for it to be treated as a table row. */
const MIN_TABLE_SEGS = 3;

function segText(seg: Seg): { text: string; runs: string[] } {
  // merge consecutive protected parts into single placeholder runs
  const runs: string[] = [];
  let out = '';
  let pending = '';
  const flushProtected = () => {
    if (!pending) return;
    // very short fragments ("=", "(1)") are not worth a placeholder
    if (pending.trim().length <= 1) {
      out += pending;
    } else {
      out += `${PROTECT_OPEN}${runs.length}${PROTECT_CLOSE}`;
      runs.push(pending.trim());
    }
    pending = '';
  };
  for (const part of seg.parts) {
    if (part.protected) {
      pending += part.str;
    } else {
      flushProtected();
      out += part.str;
    }
  }
  flushProtected();
  return { text: out, runs };
}

/** Merge a group of lines into one paragraph text, re-numbering placeholders. */
function groupText(group: Line[]): { text: string; runs: string[] } {
  const runs: string[] = [];
  const lineTexts: string[] = [];
  for (const line of group) {
    const pieces: string[] = [];
    for (const seg of line.segs) {
      const st = segText(seg);
      // renumber this segment's placeholders into the paragraph-wide list
      const shifted = st.text.replace(/⟦(\d{1,3})⟧/g, (_, num: string) => {
        const local = Number(num);
        const run = st.runs[local];
        if (run === undefined) return '';
        const idx = runs.length;
        runs.push(run);
        return `${PROTECT_OPEN}${idx}${PROTECT_CLOSE}`;
      });
      pieces.push(shifted);
    }
    lineTexts.push(pieces.join(' ').trim());
  }
  const text = lineTexts
    .join(' ')
    .replace(/-\s+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, runs };
}

/**
 * Extract text items from a page and cluster them into paragraphs:
 * items -> lines (by y proximity) -> paragraphs (by vertical gap and indent).
 * Lines with ≥3 well-separated segments are treated as table rows and each
 * segment becomes its own cell paragraph, so tables translate cell-by-cell
 * and overlay along the original grid.
 */
export async function extractPageParagraphs(
  doc: PDFDocumentProxy,
  pageIndex: number,
): Promise<PdfPageData> {
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const styles = content.styles as Record<string, { fontFamily?: string }>;

  interface Item {
    x: number;
    y: number;
    w: number;
    h: number;
    str: string;
    protected: boolean;
  }
  const items: Item[] = [];
  for (const raw of content.items) {
    const it = raw as {
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
      fontName?: string;
    };
    if (!it.str || !it.transform) continue;
    if (it.str.trim().length === 0) continue;
    const a = it.transform[0] ?? 0;
    const b = it.transform[1] ?? 0;
    const e = it.transform[4] ?? 0;
    const f = it.transform[5] ?? 0;
    const fontH = Math.hypot(a, b) || it.height || 10;
    const fontName = it.fontName ?? '';
    const mono = styles[fontName]?.fontFamily === 'monospace';
    // resolve the real PostScript name when pdf.js has it loaded
    let psName = fontName;
    try {
      const fontObj = page.commonObjs.get(fontName) as { name?: string } | undefined;
      if (fontObj?.name) psName = fontObj.name;
    } catch {
      // font not resolved yet; fall back to char/style heuristics
    }
    items.push({
      x: e,
      y: f,
      w: it.width ?? 0,
      h: fontH,
      str: it.str,
      protected: isProtectedItem(it.str, psName, mono),
    });
  }

  // group items into lines by y proximity; keep per-item segments for gaps
  items.sort((p, q) => q.y - p.y || p.x - q.x);
  interface WipLine extends Line {
    itemList: Item[];
  }
  const lines: WipLine[] = [];
  for (const it of items) {
    const tol = Math.max(2, it.h * 0.45);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) {
      line.itemList.push(it);
      line.x0 = Math.min(line.x0, it.x);
      line.x1 = Math.max(line.x1, it.x + it.w);
      line.height = Math.max(line.height, it.h);
    } else {
      lines.push({
        y: it.y,
        x0: it.x,
        x1: it.x + it.w,
        height: it.h,
        segs: [],
        itemList: [it],
      });
    }
  }
  lines.sort((p, q) => q.y - p.y);

  // split each line's items into segments by large horizontal gaps
  for (const line of lines) {
    line.itemList.sort((p, q) => p.x - q.x);
    const cellGap = Math.max(10, line.height * CELL_GAP_FACTOR);
    let seg: Seg | null = null;
    let cursor = -Infinity;
    for (const it of line.itemList) {
      if (!seg || it.x - cursor > cellGap) {
        seg = { x0: it.x, x1: it.x + it.w, parts: [] };
        line.segs.push(seg);
      } else if (it.x - cursor > it.h * 0.3) {
        seg.parts.push({ str: ' ', protected: false });
      }
      seg.parts.push({ str: it.str, protected: it.protected });
      seg.x1 = Math.max(seg.x1, it.x + it.w);
      cursor = Math.max(cursor, it.x + it.w);
    }
  }

  const paragraphs: PdfParagraph[] = [];

  const pushParagraph = (group: Line[], bbox: { x0: number; x1: number }, isCell: boolean) => {
    const { text, runs } = groupText(group);
    if (text.length < 2) return;
    const yTop = Math.max(...group.map((l) => l.y + l.height));
    const lastLine = group[group.length - 1]!;
    const yBottom = Math.min(...group.map((l) => l.y)) - lastLine.height * 0.25;
    paragraphs.push({
      text,
      protectedRuns: runs,
      ...(isCell ? { isCell: true } : {}),
      left: Math.max(0, bbox.x0 / viewport.width),
      top: Math.max(0, (viewport.height - yTop) / viewport.height),
      width: Math.min(1, (bbox.x1 - bbox.x0) / viewport.width),
      height: Math.min(1, (yTop - yBottom) / viewport.height),
      lineCount: group.length,
    });
  };

  // merge lines into paragraphs; table rows short-circuit into cell paragraphs
  let group: Line[] = [];
  const flush = () => {
    if (group.length === 0) return;
    pushParagraph(
      group,
      {
        x0: Math.min(...group.map((l) => l.x0)),
        x1: Math.max(...group.map((l) => l.x1)),
      },
      false,
    );
    group = [];
  };

  for (const line of lines) {
    if (line.segs.length >= MIN_TABLE_SEGS) {
      // table row: each segment is an independent cell
      flush();
      for (const seg of line.segs) {
        pushParagraph(
          [{ ...line, segs: [seg] }],
          { x0: seg.x0, x1: seg.x1 },
          true,
        );
      }
      continue;
    }
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
