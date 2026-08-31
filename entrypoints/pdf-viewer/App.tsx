import { useCallback, useState } from 'react';
import { Select } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import { LANGS } from '../../src/core/langs';
import { allExperts } from '../../src/core/prompts';
import { PROVIDER_LIST } from '../../src/providers';
import PdfView from './PdfView';
import { AssView, DocxView, EpubView, SrtView, TxtView } from './TextDocViews';

type DocKind = 'pdf' | 'epub' | 'txt' | 'srt' | 'docx' | 'ass';

function detectKind(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.epub')) return 'epub';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.srt')) return 'srt';
  if (name.endsWith('.ass') || name.endsWith('.ssa')) return 'ass';
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) return 'txt';
  return null;
}

export default function App() {
  const { config, update } = useConfig();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<DocKind | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(false);

  const acceptFile = useCallback((f: File | undefined) => {
    if (!f) return;
    const k = detectKind(f);
    if (!k) {
      setRejected(true);
      return;
    }
    setRejected(false);
    setFile(f);
    setKind(k);
  }, []);

  if (!config) return null;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800">文档翻译</h1>
          {file && (
            <button
              type="button"
              className="text-sm text-brand hover:underline"
              onClick={() => {
                setFile(null);
                setKind(null);
              }}
            >
              换一个文件
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Select
              value={config.sourceLang}
              onChange={(v) => update({ sourceLang: v })}
              options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
            />
          </span>
          →
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Select
              value={config.targetLang}
              onChange={(v) => update({ targetLang: v })}
              options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                value: l.code,
                label: l.label,
              }))}
            />
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Select
              value={config.provider}
              onChange={(v) => update({ provider: v as typeof config.provider })}
              options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
            />
          </span>
          <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <Select
              value={config.expertId}
              onChange={(v) => update({ expertId: v })}
              options={allExperts(config).map((e) => ({ value: e.id, label: e.name }))}
            />
          </span>
        </div>
      </header>

      {!file && (
        <label
          className={`flex h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-colors ${
            dragOver ? 'border-brand bg-blue-50/60' : 'border-gray-300 bg-white hover:border-brand/60'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
        >
          <svg viewBox="0 0 24 24" className="mb-4 h-14 w-14 text-brand/70" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="mb-1 text-lg font-medium text-gray-700">拖拽文件到这里，或点击选择</p>
          <p className="text-sm text-gray-400">支持 PDF / EPUB / DOCX / TXT / Markdown / SRT / ASS 字幕</p>
          <p className="mt-2 text-xs text-gray-300">文件在本地解析，不会被上传</p>
          {rejected && <p className="mt-3 text-sm text-red-500">暂不支持该文件格式</p>}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.epub,.docx,.txt,.md,.srt,.ass,.ssa"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {file && kind === 'pdf' && <PdfView file={file} config={config} />}
      {file && kind === 'epub' && <EpubView file={file} config={config} />}
      {file && kind === 'docx' && <DocxView file={file} config={config} />}
      {file && kind === 'txt' && <TxtView file={file} config={config} />}
      {file && kind === 'srt' && <SrtView file={file} config={config} />}
      {file && kind === 'ass' && <AssView file={file} config={config} />}
    </div>
  );
}
