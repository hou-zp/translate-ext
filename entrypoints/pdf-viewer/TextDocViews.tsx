import { useEffect, useState } from 'react';
import type { AppConfig } from '../../src/core/config';
import { buildAss, parseAss, type AssFile } from '../../src/doc/ass';
import { docxToMarkdown, parseDocx, type DocxBlock } from '../../src/doc/docx';
import { parseEpub, type EpubBook } from '../../src/doc/epub';
import { buildSrt, parseSrt, type SrtCue } from '../../src/doc/srt';
import { downloadText, parseTxt } from '../../src/doc/txt';
import { BilingualList, ProgressBar, ToolButton } from './shared';
import { useDocTranslator } from './useDocTranslator';

// ---------------------------------------------------------------------------
// EPUB
// ---------------------------------------------------------------------------

export function EpubView(props: { file: File; config: AppConfig }) {
  const [book, setBook] = useState<EpubBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const { results, progress, start, cancel } = useDocTranslator(props.config);

  useEffect(() => {
    void props.file
      .arrayBuffer()
      .then(parseEpub)
      .then(setBook)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [props.file]);

  if (error) return <p className="p-10 text-center text-sm text-red-500">{error}</p>;
  if (!book) return <p className="p-10 text-center text-sm text-gray-400">正在解析 EPUB…</p>;

  const allItems = book.chapters.flatMap((ch, ci) =>
    ch.paragraphs.map((text, pi) => ({ key: `${ci}-${pi}`, text })),
  );
  const chapter = book.chapters[chapterIdx] ?? book.chapters[0]!;

  const exportMd = () => {
    const out: string[] = [`# ${book.title}`];
    book.chapters.forEach((ch, ci) => {
      out.push(`\n## ${ch.title}\n`);
      ch.paragraphs.forEach((_, pi) => {
        const tr = results[`${ci}-${pi}`];
        if (tr) out.push(tr);
      });
    });
    downloadText(`${book.title}-译文.md`, out.join('\n\n'), 'text/markdown');
  };

  return (
    <div className="flex gap-5">
      <aside className="w-56 shrink-0">
        <div className="sticky top-6 max-h-[calc(100vh-60px)] overflow-auto rounded-xl bg-white p-3 shadow-sm">
          <h2 className="mb-2 line-clamp-2 px-2 text-sm font-semibold text-gray-800">
            {book.title}
          </h2>
          {book.chapters.map((ch, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setChapterIdx(i)}
              className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs ${
                i === chapterIdx ? 'bg-brand/10 text-brand' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {ch.title}
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-gray-600">
            {book.chapters.length} 章 · {allItems.length} 段
          </span>
          {!progress.running ? (
            <ToolButton primary onClick={() => void start(allItems)}>
              {progress.done > 0 ? '重新翻译' : '翻译全书'}
            </ToolButton>
          ) : (
            <ToolButton onClick={cancel}>停止</ToolButton>
          )}
          <ToolButton onClick={exportMd}>导出 Markdown</ToolButton>
          <ProgressBar progress={progress} />
        </div>
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{chapter.title}</h3>
        <BilingualList
          paragraphs={chapter.paragraphs.map((text, pi) => ({
            key: `${chapterIdx}-${pi}`,
            text,
          }))}
          results={results}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TXT
// ---------------------------------------------------------------------------

export function TxtView(props: { file: File; config: AppConfig }) {
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const { results, progress, start, cancel } = useDocTranslator(props.config);

  useEffect(() => {
    void props.file.text().then((text) => setParagraphs(parseTxt(text)));
  }, [props.file]);

  if (!paragraphs) return <p className="p-10 text-center text-sm text-gray-400">正在读取…</p>;

  const items = paragraphs.map((text, i) => ({ key: String(i), text }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-gray-600">{items.length} 段</span>
        {!progress.running ? (
          <ToolButton primary onClick={() => void start(items)}>
            {progress.done > 0 ? '重新翻译' : '开始翻译'}
          </ToolButton>
        ) : (
          <ToolButton onClick={cancel}>停止</ToolButton>
        )}
        <ToolButton
          onClick={() =>
            downloadText(
              props.file.name.replace(/\.txt$/i, '') + '-译文.txt',
              items.map((it) => results[it.key] ?? '').join('\n\n'),
            )
          }
        >
          导出 TXT
        </ToolButton>
        <ProgressBar progress={progress} />
      </div>
      <BilingualList paragraphs={items} results={results} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

const HEADING_CLS: Record<string, string> = {
  h1: 'text-xl font-bold',
  h2: 'text-lg font-bold',
  h3: 'text-base font-semibold',
};

export function DocxView(props: { file: File; config: AppConfig }) {
  const [blocks, setBlocks] = useState<DocxBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bilingual, setBilingual] = useState(true);
  const { results, progress, start, cancel } = useDocTranslator(props.config);

  useEffect(() => {
    void props.file
      .arrayBuffer()
      .then(parseDocx)
      .then(setBlocks)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [props.file]);

  if (error) return <p className="p-10 text-center text-sm text-red-500">解析失败：{error}</p>;
  if (!blocks) return <p className="p-10 text-center text-sm text-gray-400">正在解析 DOCX…</p>;
  if (blocks.length === 0)
    return <p className="p-10 text-center text-sm text-red-500">文档中没有可翻译的文本</p>;

  const items = blocks.map((b, i) => ({ key: String(i), text: b.text }));

  const exportMd = () => {
    const translations = blocks.map((_, i) => results[String(i)] ?? null);
    downloadText(
      props.file.name.replace(/\.docx$/i, '') + (bilingual ? '-双语.md' : '-译文.md'),
      docxToMarkdown(blocks, translations, bilingual),
      'text/markdown',
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-gray-600">{items.length} 段</span>
        {!progress.running ? (
          <ToolButton primary onClick={() => void start(items)}>
            {progress.done > 0 ? '重新翻译' : '开始翻译'}
          </ToolButton>
        ) : (
          <ToolButton onClick={cancel}>停止</ToolButton>
        )}
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={bilingual}
            onChange={(e) => setBilingual(e.target.checked)}
          />
          导出双语
        </label>
        <ToolButton onClick={exportMd}>导出 Markdown</ToolButton>
        <ProgressBar progress={progress} />
      </div>
      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-xl bg-white px-4 py-3 shadow-sm">
            <p className={`text-gray-500 ${HEADING_CLS[b.tag] ?? 'text-sm'}`}>{b.text}</p>
            <p className={`mt-1 text-gray-900 ${HEADING_CLS[b.tag] ?? 'text-sm'}`}>
              {results[String(i)] ?? <span className="text-gray-300">待翻译…</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASS / SSA subtitles
// ---------------------------------------------------------------------------

export function AssView(props: { file: File; config: AppConfig }) {
  const [ass, setAss] = useState<AssFile | null>(null);
  const [bilingual, setBilingual] = useState(true);
  const { results, progress, start, cancel } = useDocTranslator(props.config);

  useEffect(() => {
    void props.file.text().then((text) => setAss(parseAss(text)));
  }, [props.file]);

  if (!ass) return <p className="p-10 text-center text-sm text-gray-400">正在解析字幕…</p>;
  if (ass.cues.length === 0)
    return <p className="p-10 text-center text-sm text-red-500">未解析到有效字幕条目</p>;

  const items = ass.cues.map((cue, i) => ({ key: String(i), text: cue.text.replace(/\n/g, ' ') }));

  const exportAss = () => {
    const translations = ass.cues.map((_, i) => results[String(i)] ?? null);
    downloadText(
      props.file.name.replace(/\.(ass|ssa)$/i, '') + (bilingual ? '-双语.ass' : '-译文.ass'),
      buildAss(ass, translations, bilingual),
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-gray-600">{ass.cues.length} 条字幕</span>
        {!progress.running ? (
          <ToolButton primary onClick={() => void start(items)}>
            {progress.done > 0 ? '重新翻译' : '开始翻译'}
          </ToolButton>
        ) : (
          <ToolButton onClick={cancel}>停止</ToolButton>
        )}
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={bilingual}
            onChange={(e) => setBilingual(e.target.checked)}
          />
          导出双语字幕
        </label>
        <ToolButton onClick={exportAss}>导出 ASS</ToolButton>
        <ProgressBar progress={progress} />
      </div>
      <div className="space-y-2">
        {ass.cues.map((cue, i) => (
          <div key={i} className="rounded-xl bg-white px-4 py-3 shadow-sm">
            <div className="mb-1 text-xs text-gray-400">
              #{i + 1} · {cue.start} → {cue.end}
            </div>
            <p className="text-sm text-gray-500">{cue.text}</p>
            <p className="mt-1 text-sm text-gray-900">
              {results[String(i)] ?? <span className="text-gray-300">待翻译…</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SRT subtitles
// ---------------------------------------------------------------------------

export function SrtView(props: { file: File; config: AppConfig }) {
  const [cues, setCues] = useState<SrtCue[] | null>(null);
  const [bilingual, setBilingual] = useState(true);
  const { results, progress, start, cancel } = useDocTranslator(props.config);

  useEffect(() => {
    void props.file.text().then((text) => setCues(parseSrt(text)));
  }, [props.file]);

  if (!cues) return <p className="p-10 text-center text-sm text-gray-400">正在解析字幕…</p>;
  if (cues.length === 0)
    return <p className="p-10 text-center text-sm text-red-500">未解析到有效字幕条目</p>;

  const items = cues.map((cue, i) => ({ key: String(i), text: cue.text.replace(/\n/g, ' ') }));

  const exportSrt = () => {
    const translations = cues.map((_, i) => results[String(i)] ?? null);
    downloadText(
      props.file.name.replace(/\.srt$/i, '') + (bilingual ? '-双语.srt' : '-译文.srt'),
      buildSrt(cues, translations, bilingual),
    );
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <span className="text-sm text-gray-600">{cues.length} 条字幕</span>
        {!progress.running ? (
          <ToolButton primary onClick={() => void start(items)}>
            {progress.done > 0 ? '重新翻译' : '开始翻译'}
          </ToolButton>
        ) : (
          <ToolButton onClick={cancel}>停止</ToolButton>
        )}
        <label className="flex items-center gap-1.5 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={bilingual}
            onChange={(e) => setBilingual(e.target.checked)}
          />
          导出双语字幕
        </label>
        <ToolButton onClick={exportSrt}>导出 SRT</ToolButton>
        <ProgressBar progress={progress} />
      </div>
      <div className="space-y-2">
        {cues.map((cue, i) => (
          <div key={i} className="rounded-xl bg-white px-4 py-3 shadow-sm">
            <div className="mb-1 text-xs text-gray-400">
              #{i + 1} · {cue.time}
            </div>
            <p className="text-sm text-gray-500">{cue.text}</p>
            <p className="mt-1 text-sm text-gray-900">
              {results[String(i)] ?? <span className="text-gray-300">待翻译…</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
