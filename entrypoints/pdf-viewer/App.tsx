import { useCallback, useState } from 'react';
import { FileUp } from 'lucide-react';
import { Select } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import { t } from '../../src/core/i18n';
import { LANGS } from '../../src/core/langs';
import { allExperts } from '../../src/core/prompts';
import { PROVIDER_LIST } from '../../src/providers';
import BatchPdfView from './BatchPdfView';
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
  const [batchFiles, setBatchFiles] = useState<File[] | null>(null);
  const [kind, setKind] = useState<DocKind | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState(false);

  const acceptFiles = useCallback((list: FileList | File[] | null | undefined) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    // multiple PDFs at once: batch translate + export queue
    if (files.length > 1 && files.every((f) => detectKind(f) === 'pdf')) {
      setRejected(false);
      setFile(null);
      setKind(null);
      setBatchFiles(files);
      return;
    }
    const f = files[0]!;
    const k = detectKind(f);
    if (!k) {
      setRejected(true);
      return;
    }
    setRejected(false);
    setBatchFiles(null);
    setFile(f);
    setKind(k);
  }, []);

  if (!config) return null;

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-ink">{t('文档翻译')}</h1>
          {(file || batchFiles) && (
            <button
              type="button"
              className="text-sm text-brand hover:underline"
              onClick={() => {
                setFile(null);
                setKind(null);
                setBatchFiles(null);
              }}
            >
              {t('换一个文件')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <Select
            variant="field"
            className="w-40"
            value={config.sourceLang}
            onChange={(v) => update({ sourceLang: v })}
            options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
          />
          <span className="text-ink-3">→</span>
          <Select
            variant="field"
            className="w-40"
            value={config.targetLang}
            onChange={(v) => update({ targetLang: v })}
            options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
              value: l.code,
              label: l.label,
            }))}
          />
          <Select
            variant="field"
            className="w-36"
            value={config.provider}
            onChange={(v) => update({ provider: v as typeof config.provider })}
            options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
          />
          <Select
            variant="field"
            className="w-32"
            value={config.expertId}
            onChange={(v) => update({ expertId: v })}
            options={allExperts(config).map((e) => ({ value: e.id, label: e.name }))}
          />
        </div>
      </header>

      {!file && !batchFiles && (
        <label
          className={`flex h-[420px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all duration-200 ${
            dragOver
              ? 'scale-[1.01] border-brand bg-brand-soft/60'
              : 'border-line-strong bg-card hover:border-brand/60'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFiles(e.dataTransfer.files);
          }}
        >
          <FileUp
            className={`mb-4 h-14 w-14 transition-transform duration-200 ${
              dragOver ? 'scale-110 text-brand' : 'text-brand/70'
            }`}
            strokeWidth={1.2}
          />
          <p className="mb-1 text-lg font-medium text-ink">{t('拖拽文件到这里，或点击选择')}</p>
          <p className="text-sm text-ink-3">
            {t('支持 PDF / EPUB / DOCX / TXT / Markdown / SRT / ASS 字幕，多选 PDF 可批量翻译导出')}
          </p>
          <p className="mt-2 text-xs text-ink-3/70">{t('文件在本地解析，不会被上传')}</p>
          {rejected && <p className="mt-3 text-sm text-danger">{t('暂不支持该文件格式')}</p>}
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.epub,.docx,.txt,.md,.srt,.ass,.ssa"
            onChange={(e) => {
              acceptFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}

      {batchFiles && <BatchPdfView files={batchFiles} config={config} />}
      {file && kind === 'pdf' && <PdfView file={file} config={config} />}
      {file && kind === 'epub' && <EpubView file={file} config={config} />}
      {file && kind === 'docx' && <DocxView file={file} config={config} />}
      {file && kind === 'txt' && <TxtView file={file} config={config} />}
      {file && kind === 'srt' && <SrtView file={file} config={config} />}
      {file && kind === 'ass' && <AssView file={file} config={config} />}
    </div>
  );
}
