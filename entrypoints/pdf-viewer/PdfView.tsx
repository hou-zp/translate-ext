import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { AppConfig } from '../../src/core/config';
import { sendToBackground } from '../../src/core/messaging';
import { downloadBytes, exportBilingualPdf, fetchCjkFont } from '../../src/doc/pdf-export';
import { translatePdfRemote } from '../../src/doc/pdf-remote';
import { downloadText } from '../../src/doc/txt';
import {
  extractPageParagraphs,
  openPdf,
  renderPageToCanvas,
  restoreProtectedRuns,
  type PdfPageData,
} from '../../src/doc/pdf';
import { t } from '../../src/core/i18n';
import { useDocTranslator } from './useDocTranslator';
import { ProgressBar, ToolButton } from './shared';

const PAGE_WIDTH = 760;

type ViewMode = 'side' | 'overlay';

function PdfPageCanvas(props: {
  doc: PDFDocumentProxy;
  page: PdfPageData;
  mode: ViewMode;
  results: Record<string, string>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !rendered) {
          setRendered(true);
          if (canvasRef.current) {
            void renderPageToCanvas(props.doc, props.page.pageIndex, canvasRef.current, PAGE_WIDTH);
          }
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(holder);
    return () => io.disconnect();
  }, [props.doc, props.page.pageIndex, rendered]);

  const cssHeight = (props.page.pageHeight / props.page.pageWidth) * PAGE_WIDTH;

  return (
    <div
      ref={holderRef}
      className="relative mx-auto mb-4 bg-white shadow"
      style={{ width: PAGE_WIDTH, height: cssHeight }}
    >
      <canvas ref={canvasRef} />
      {props.mode === 'overlay' &&
        props.page.paragraphs.map((para, i) => {
          const key = `${props.page.pageIndex}-${i}`;
          const raw = props.results[key];
          if (!raw) return null;
          const tr = restoreProtectedRuns(raw, para.protectedRuns);
          const heightPx = para.height * cssHeight;
          const fontSize = Math.max(9, Math.min(18, (heightPx / para.lineCount) * 0.66));
          return (
            <div
              key={key}
              className="absolute overflow-hidden bg-paper/95 leading-snug text-inktext"
              style={{
                left: `${para.left * 100}%`,
                top: `${para.top * 100}%`,
                width: `${para.width * 100}%`,
                minHeight: heightPx,
                fontSize,
              }}
              title={restoreProtectedRuns(para.text, para.protectedRuns)}
            >
              {tr}
            </div>
          );
        })}
    </div>
  );
}

export default function PdfView(props: { file: File; config: AppConfig }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PdfPageData[]>([]);
  const [mode, setMode] = useState<ViewMode>('side');
  const [parseError, setParseError] = useState<string | null>(null);
  const { results, progress, start, cancel } = useDocTranslator(props.config);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [ocrResults, setOcrResults] = useState<Record<number, string>>({});
  const [ocrState, setOcrState] = useState<{ running: boolean; done: number; error?: string }>({
    running: false,
    done: 0,
  });
  const ocrCancel = useRef(false);
  const [pdfExport, setPdfExport] = useState<{ running: boolean; note: string }>({
    running: false,
    note: '',
  });
  const [remote, setRemote] = useState<{ running: boolean; note: string }>({
    running: false,
    note: '',
  });
  const remoteAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const buf = await props.file.arrayBuffer();
        const pdf = await openPdf(buf);
        if (!alive) return;
        setDoc(pdf);
        const all: PdfPageData[] = [];
        for (let i = 0; i < pdf.numPages; i++) {
          all.push(await extractPageParagraphs(pdf, i));
          if (!alive) return;
        }
        setPages(all);
      } catch (err) {
        if (alive) setParseError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.file]);

  const allItems = pages.flatMap((page) =>
    page.paragraphs.map((para, i) => ({ key: `${page.pageIndex}-${i}`, text: para.text })),
  );

  // pages without a text layer (scanned/image-only) can be OCR-translated
  const scannedPages = pages.filter((p) => p.paragraphs.length === 0);

  const runOcr = async () => {
    if (!doc) return;
    ocrCancel.current = false;
    setOcrState({ running: true, done: 0 });
    let done = 0;
    for (const page of scannedPages) {
      if (ocrCancel.current) break;
      if (ocrResults[page.pageIndex]) {
        done++;
        continue;
      }
      try {
        const canvas = document.createElement('canvas');
        await renderPageToCanvas(doc, page.pageIndex, canvas, 1000);
        const dataUrl = canvas.toDataURL('image/png');
        const res = await sendToBackground('translateImage', {
          srcUrl: dataUrl,
          to: props.config.targetLang,
        });
        setOcrResults((prev) => ({ ...prev, [page.pageIndex]: res.text }));
        done++;
        setOcrState({ running: true, done });
      } catch (err) {
        setOcrState({
          running: false,
          done,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }
    setOcrState({ running: false, done });
  };

  const exportHtml = () => {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const body = pages
      .map((page) => {
        const paras = page.paragraphs
          .map((para, i) => {
            const raw = results[`${page.pageIndex}-${i}`];
            const tr = raw ? restoreProtectedRuns(raw, para.protectedRuns) : null;
            return (
              `<p class="orig">${esc(restoreProtectedRuns(para.text, para.protectedRuns))}</p>` +
              (tr ? `<p class="trans">${esc(tr)}</p>` : '')
            );
          })
          .join('\n');
        const ocr = ocrResults[page.pageIndex]
          ? `<p class="trans">${esc(ocrResults[page.pageIndex]!)}</p>`
          : '';
        return `<section><h2>第 ${page.pageIndex + 1} 页</h2>\n${paras}${ocr}</section>`;
      })
      .join('\n');
    const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>${esc(props.file.name)} - 双语对照</title>
<style>
body{font:15px/1.75 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:800px;margin:32px auto;padding:0 20px;color:#111}
h2{font-size:13px;color:#999;border-bottom:1px solid #eee;padding-bottom:4px;margin:28px 0 12px}
.orig{color:#666;margin:10px 0 2px}
.trans{color:#111;margin:0 0 14px;border-left:3px solid #3b82f6;padding-left:10px}
@media print{.orig{page-break-inside:avoid}.trans{page-break-inside:avoid}}
</style></head><body>
<h1 style="font-size:18px">${esc(props.file.name)} · 双语对照</h1>
${body}
</body></html>`;
    downloadText(props.file.name.replace(/\.pdf$/i, '') + '-双语.html', html, 'text/html');
  };

  const restoredTranslation = (pageIndex: number, paraIndex: number): string | null => {
    const raw = results[`${pageIndex}-${paraIndex}`];
    if (!raw) return null;
    const para = pages.find((p) => p.pageIndex === pageIndex)?.paragraphs[paraIndex];
    return para ? restoreProtectedRuns(raw, para.protectedRuns) : raw;
  };

  const exportPdf = async () => {
    setPdfExport({ running: true, note: t('准备导出') + '…' });
    try {
      const original = await props.file.arrayBuffer();
      const cjkNeeded =
        Object.values(results).some((v) => /[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(v)) ||
        Object.values(ocrResults).some((v) =>
          /[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(v),
        );
      let cjkFont: ArrayBuffer | undefined;
      if (cjkNeeded) {
        cjkFont = await fetchCjkFont((loaded, total) => {
          const mb = (n: number) => (n / 1048576).toFixed(1);
          setPdfExport({
            running: true,
            note: `${t('下载字体')} ${mb(loaded)}${total ? `/${mb(total)}` : ''} MB…`,
          });
        });
      }
      setPdfExport({ running: true, note: t('生成 PDF') + '…' });
      const bytes = await exportBilingualPdf({
        original,
        pages,
        translationFor: restoredTranslation,
        pageFallback: (p) => ocrResults[p] ?? null,
        cjkFont,
      });
      downloadBytes(props.file.name.replace(/\.pdf$/i, '') + '-双语.pdf', bytes);
      setPdfExport({ running: false, note: '' });
    } catch (err) {
      setPdfExport({
        running: false,
        note: `${t('导出失败')}：${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const runRemote = async () => {
    const base = props.config.pdfServiceUrl.trim();
    if (!base) return;
    remoteAbort.current = new AbortController();
    setRemote({ running: true, note: t('上传中') + '…' });
    try {
      const blob = await translatePdfRemote(
        base,
        props.file,
        props.config.sourceLang,
        props.config.targetLang,
        (p) => {
          if (p.stage === 'translate') {
            setRemote({
              running: true,
              note:
                p.total != null && p.done != null
                  ? `${t('服务端翻译中')} ${p.done}/${p.total}…`
                  : t('服务端翻译中') + '…',
            });
          } else if (p.stage === 'download') {
            setRemote({ running: true, note: t('下载结果') + '…' });
          }
        },
        remoteAbort.current.signal,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = props.file.name.replace(/\.pdf$/i, '') + '-服务端双语.pdf';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setRemote({ running: false, note: '' });
    } catch (err) {
      setRemote({
        running: false,
        note: `${t('服务端翻译失败')}：${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const exportText = (markdown: boolean) => {
    const out: string[] = [];
    for (const page of pages) {
      out.push(markdown ? `## 第 ${page.pageIndex + 1} 页` : `【第 ${page.pageIndex + 1} 页】`);
      page.paragraphs.forEach((para, i) => {
        const tr = results[`${page.pageIndex}-${i}`];
        if (tr) out.push(restoreProtectedRuns(tr, para.protectedRuns));
      });
      out.push('');
    }
    downloadText(
      props.file.name.replace(/\.pdf$/i, '') + (markdown ? '-译文.md' : '-译文.txt'),
      out.join('\n\n'),
      markdown ? 'text/markdown' : 'text/plain',
    );
  };

  if (parseError) {
    return (
      <p className="p-10 text-center text-sm text-danger">
        {t('PDF 解析失败')}：{parseError}
      </p>
    );
  }
  if (!doc || pages.length === 0) {
    return <p className="p-10 text-center text-sm text-ink-3">{t('正在解析 PDF')}…</p>;
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-card/80 px-4 py-3 shadow-card">
        <span className="text-sm text-ink-2">
          {t('共')} {doc.numPages} {t('页')} · {allItems.length} {t('段')}
        </span>
        <div className="flex rounded-lg bg-fill p-0.5 text-sm">
          {(
            [
              ['side', t('对照模式')],
              ['overlay', t('叠加模式')],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              className={`rounded-md px-3 py-1 transition-all duration-150 ${
                mode === v ? 'bg-card text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!progress.running ? (
          <ToolButton primary onClick={() => void start(allItems)}>
            {progress.done > 0 ? t('重新翻译') : t('开始翻译')}
          </ToolButton>
        ) : (
          <ToolButton onClick={cancel}>{t('停止')}</ToolButton>
        )}
        {scannedPages.length > 0 &&
          (!ocrState.running ? (
            <ToolButton onClick={() => void runOcr()}>
              {t('OCR 翻译扫描页')}（{scannedPages.length}）
            </ToolButton>
          ) : (
            <ToolButton
              onClick={() => {
                ocrCancel.current = true;
              }}
            >
              {t('停止 OCR')}（{ocrState.done}/{scannedPages.length}）
            </ToolButton>
          ))}
        <ToolButton onClick={() => exportText(false)}>{t('导出 TXT')}</ToolButton>
        <ToolButton onClick={() => exportText(true)}>{t('导出 Markdown')}</ToolButton>
        <ToolButton onClick={exportHtml}>{t('导出双语 HTML')}</ToolButton>
        <ToolButton
          onClick={() => {
            if (!pdfExport.running) void exportPdf();
          }}
        >
          {pdfExport.running ? pdfExport.note || t('导出中') + '…' : t('导出双语 PDF')}
        </ToolButton>
        {!pdfExport.running && pdfExport.note && (
          <span className="text-xs text-danger">{pdfExport.note}</span>
        )}
        {props.config.pdfServiceUrl.trim() &&
          (!remote.running ? (
            <ToolButton onClick={() => void runRemote()}>{t('服务端精排翻译')}</ToolButton>
          ) : (
            <ToolButton onClick={() => remoteAbort.current?.abort()}>
              {remote.note || t('处理中') + '…'}（{t('点击取消')}）
            </ToolButton>
          ))}
        {!remote.running && remote.note && (
          <span className="text-xs text-danger">{remote.note}</span>
        )}
        <ProgressBar progress={progress} />
        {ocrState.error && (
          <span className="text-xs text-danger">
            {t('OCR 失败')}：{ocrState.error}（{t('需要多模态模型')}）
          </span>
        )}
      </div>

      <div className={mode === 'side' ? 'flex gap-4' : ''}>
        <div className={mode === 'side' ? 'min-w-0 flex-1' : ''}>
          {pages.map((page) => (
            <div
              key={page.pageIndex}
              ref={(el) => {
                pageRefs.current[page.pageIndex] = el;
              }}
            >
              <PdfPageCanvas doc={doc} page={page} mode={mode} results={results} />
            </div>
          ))}
        </div>

        {mode === 'side' && (
          <aside className="w-[420px] shrink-0">
            <div className="sticky top-20 max-h-[calc(100vh-120px)] overflow-auto rounded-md border border-line bg-card/80 p-4 shadow-card">
              {pages.map((page) => (
                <div key={page.pageIndex} className="mb-4">
                  <button
                    type="button"
                    className="mb-2 text-xs font-semibold text-brand-hi hover:underline"
                    onClick={() =>
                      pageRefs.current[page.pageIndex]?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }
                  >
                    {t('第')} {page.pageIndex + 1} {t('页')}
                  </button>
                  {page.paragraphs.map((para, i) => {
                    const raw = results[`${page.pageIndex}-${i}`];
                    const tr = raw ? restoreProtectedRuns(raw, para.protectedRuns) : null;
                    return (
                      <p
                        key={i}
                        className="mb-2 border-b border-line/50 pb-2 text-sm leading-6 text-ink"
                      >
                        {tr ?? (
                          <span className="text-ink-3">
                            {restoreProtectedRuns(para.text, para.protectedRuns)}
                          </span>
                        )}
                      </p>
                    );
                  })}
                  {page.paragraphs.length === 0 && (
                    <p className="mb-2 whitespace-pre-wrap border-b border-line/50 pb-2 text-sm leading-6 text-ink">
                      {ocrResults[page.pageIndex] ?? (
                        <span className="text-ink-3">
                          {t('扫描页，无文本层')}
                          {scannedPages.length > 0 ? t('，可用 OCR 翻译') : ''}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
