import { useEffect, useRef, useState } from 'react';
import type { AppConfig } from '../../src/core/config';
import { t } from '../../src/core/i18n';
import { sendToBackground } from '../../src/core/messaging';
import {
  extractPageParagraphs,
  openPdf,
  restoreProtectedRuns,
  type PdfPageData,
} from '../../src/doc/pdf';
import { downloadBytes, exportBilingualPdf, fetchCjkFont } from '../../src/doc/pdf-export';
import { ToolButton } from './shared';

const CHUNK = 16;

type FileState = 'pending' | 'parsing' | 'translating' | 'exporting' | 'done' | 'error';

interface FileJob {
  file: File;
  state: FileState;
  done: number;
  total: number;
  error?: string;
}

/**
 * Batch queue: multiple PDFs are parsed, translated and exported as
 * bilingual PDFs one after another.
 */
export default function BatchPdfView(props: { files: File[]; config: AppConfig }) {
  const [jobs, setJobs] = useState<FileJob[]>(
    props.files.map((file) => ({ file, state: 'pending', done: 0, total: 0 })),
  );
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);

  const patch = (idx: number, p: Partial<FileJob>) =>
    setJobs((prev) => prev.map((j, i) => (i === idx ? { ...j, ...p } : j)));

  const runOne = async (idx: number): Promise<void> => {
    const { file } = props.files[idx] ? { file: props.files[idx]! } : { file: null };
    if (!file) return;
    patch(idx, { state: 'parsing' });
    const original = await file.arrayBuffer();
    const pdf = await openPdf(original.slice(0));
    const pages: PdfPageData[] = [];
    for (let i = 0; i < pdf.numPages; i++) {
      pages.push(await extractPageParagraphs(pdf, i));
      if (cancelled.current) return;
    }

    const items = pages.flatMap((page) =>
      page.paragraphs.map((para, i) => ({
        key: `${page.pageIndex}-${i}`,
        text: para.text,
      })),
    );
    patch(idx, { state: 'translating', total: items.length, done: 0 });

    const results: Record<string, string> = {};
    for (let i = 0; i < items.length; i += CHUNK) {
      if (cancelled.current) return;
      const chunk = items.slice(i, i + CHUNK);
      const res = await sendToBackground('translateBatch', {
        texts: chunk.map((c) => c.text),
        from: props.config.sourceLang,
        to: props.config.targetLang,
        expertId: props.config.expertId,
      });
      chunk.forEach((c, j) => {
        const v = res.results[j];
        if (v) results[c.key] = v;
      });
      patch(idx, { done: Math.min(i + CHUNK, items.length) });
    }

    patch(idx, { state: 'exporting' });
    const cjkNeeded = Object.values(results).some((v) =>
      /[\u2E80-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(v),
    );
    const cjkFont = cjkNeeded ? await fetchCjkFont() : undefined;
    const bytes = await exportBilingualPdf({
      original,
      pages,
      translationFor: (p, i) => {
        const raw = results[`${p}-${i}`];
        if (!raw) return null;
        const para = pages.find((pg) => pg.pageIndex === p)?.paragraphs[i];
        return para ? restoreProtectedRuns(raw, para.protectedRuns) : raw;
      },
      cjkFont,
    });
    downloadBytes(file.name.replace(/\.pdf$/i, '') + '-双语.pdf', bytes);
    patch(idx, { state: 'done' });
  };

  const runAll = async () => {
    if (running) return;
    cancelled.current = false;
    setRunning(true);
    for (let i = 0; i < props.files.length; i++) {
      if (cancelled.current) break;
      const state = jobs[i]?.state;
      if (state === 'done') continue;
      try {
        await runOne(i);
      } catch (err) {
        patch(i, {
          state: 'error',
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    setRunning(false);
  };

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const STATE_LABEL: Record<FileState, string> = {
    pending: t('等待中'),
    parsing: t('解析中'),
    translating: t('翻译中'),
    exporting: t('导出中'),
    done: t('已完成'),
    error: t('失败'),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-ink-2">
          {t('批量翻译')} · {props.files.length} {t('个 PDF，逐个翻译并导出双语 PDF')}
        </span>
        {!running ? (
          <ToolButton primary onClick={() => void runAll()}>
            {t('开始批量翻译')}
          </ToolButton>
        ) : (
          <ToolButton
            onClick={() => {
              cancelled.current = true;
            }}
          >
            {t('停止')}
          </ToolButton>
        )}
      </div>
      <div className="space-y-2">
        {jobs.map((job, i) => (
          <div
            key={`${job.file.name}-${i}`}
            className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-sm text-ink">{job.file.name}</div>
              {job.state === 'error' && (
                <div className="truncate text-xs text-danger">{job.error}</div>
              )}
            </div>
            <span
              className={`shrink-0 text-xs ${
                job.state === 'done'
                  ? 'text-success'
                  : job.state === 'error'
                    ? 'text-danger'
                    : 'text-ink-2'
              }`}
            >
              {STATE_LABEL[job.state]}
              {job.state === 'translating' && job.total > 0 && ` ${job.done}/${job.total}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
