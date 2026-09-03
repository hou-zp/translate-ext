import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { ArrowRightLeft, Copy, Eraser, History, Volume2, X } from 'lucide-react';
import { Button, Select, useToast } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import { t } from '../../src/core/i18n';
import { LANGS, langLabel } from '../../src/core/langs';
import { streamTranslate } from '../../src/core/messaging';
import { allExperts } from '../../src/core/prompts';
import { PROVIDER_LIST } from '../../src/providers';

interface HistoryItem {
  id: number;
  from: string;
  to: string;
  source: string;
  result: string;
  provider: string;
  at: number;
}

const HISTORY_KEY = 'text-history';
const HISTORY_MAX = 50;

async function loadHistory(): Promise<HistoryItem[]> {
  const data = await browser.storage.local.get(HISTORY_KEY);
  return (data[HISTORY_KEY] as HistoryItem[] | undefined) ?? [];
}

async function pushHistory(item: HistoryItem): Promise<HistoryItem[]> {
  const list = [item, ...(await loadHistory())].slice(0, HISTORY_MAX);
  await browser.storage.local.set({ [HISTORY_KEY]: list });
  return list;
}

function PaneAction(props: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={props.title}
      onClick={props.onClick}
      className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-fill hover:text-ink"
    >
      {props.children}
    </button>
  );
}

export default function App() {
  const { config, update } = useConfig();
  const toast = useToast();
  const [source, setSource] = useState('');
  const [result, setResult] = useState('');
  const [translating, setTranslating] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [compareOn, setCompareOn] = useState(false);
  const [compareProvider, setCompareProvider] = useState<string>('');
  const [compareResult, setCompareResult] = useState('');
  const [compareTranslating, setCompareTranslating] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const cancelCompareRef = useRef<(() => void) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void loadHistory().then(setHistory);
    return () => {
      cancelRef.current?.();
      cancelCompareRef.current?.();
    };
  }, []);

  const effectiveCompare =
    compareProvider ||
    PROVIDER_LIST.find((p) => p.id !== config?.provider)?.id ||
    'google';

  const doCompareTranslate = (trimmed: string) => {
    if (!config) return;
    cancelCompareRef.current?.();
    setCompareTranslating(true);
    setCompareResult('');
    let acc = '';
    cancelCompareRef.current = streamTranslate(
      {
        text: trimmed,
        from: config.sourceLang,
        to: config.targetLang,
        provider: effectiveCompare as typeof config.provider,
        expertId: config.expertId,
      },
      (ev) => {
        if (ev.kind === 'delta') {
          acc += ev.text;
          setCompareResult(acc);
        } else if (ev.kind === 'done') {
          setCompareResult(ev.full);
          setCompareTranslating(false);
        } else {
          setCompareTranslating(false);
          setCompareResult(`⚠ ${ev.message}`);
        }
      },
    );
  };

  const doTranslate = (text: string) => {
    cancelRef.current?.();
    const trimmed = text.trim();
    if (!trimmed || !config) {
      setResult('');
      setCompareResult('');
      return;
    }
    if (compareOn) doCompareTranslate(trimmed);
    setTranslating(true);
    setResult('');
    let acc = '';
    cancelRef.current = streamTranslate(
      {
        text: trimmed,
        from: config.sourceLang,
        to: config.targetLang,
        expertId: config.expertId,
      },
      (ev) => {
        if (ev.kind === 'delta') {
          acc += ev.text;
          setResult(acc);
        } else if (ev.kind === 'done') {
          setResult(ev.full);
          setTranslating(false);
          void pushHistory({
            id: Date.now(),
            from: config.sourceLang,
            to: config.targetLang,
            source: trimmed,
            result: ev.full,
            provider: config.provider,
            at: Date.now(),
          }).then(setHistory);
        } else {
          setTranslating(false);
          toast(ev.message, 'error');
        }
      },
    );
  };

  const onSourceChange = (text: string) => {
    setSource(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doTranslate(text), 700);
  };

  const swap = () => {
    if (!config || config.sourceLang === 'auto') return;
    update({ sourceLang: config.targetLang, targetLang: config.sourceLang });
    setSource(result);
    setResult(source);
  };

  const copyText = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toast(t('已复制'), 'success'));
  };

  const speak = (text: string, lang: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'auto' ? '' : lang;
    speechSynthesis.speak(u);
  };

  if (!config) return null;

  const paneCls = 'rounded-lg border border-line bg-card/80 p-4 shadow-card';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      {/* toolbar */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">{t('文本翻译')}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
          <Button
            variant={compareOn ? 'primary' : 'secondary'}
            onClick={() => {
              setCompareOn((v) => !v);
              if (!compareOn && source.trim()) doCompareTranslate(source.trim());
            }}
          >
            {t('双引擎对比')}
          </Button>
          {compareOn && (
            <Select
              variant="field"
              className="w-36"
              value={effectiveCompare}
              onChange={(v) => {
                setCompareProvider(v);
                setCompareResult('');
              }}
              options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
            />
          )}
          <Button
            variant={showHistory ? 'primary' : 'secondary'}
            icon={<History className="h-4 w-4" />}
            onClick={() => setShowHistory((v) => !v)}
          >
            {t('历史记录')}
          </Button>
        </div>
      </header>

      {/* language pair */}
      <div className="mb-4 flex items-center justify-center gap-3">
        <Select
          variant="field"
          className="w-44"
          value={config.sourceLang}
          onChange={(v) => update({ sourceLang: v })}
          options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
        />
        <button
          type="button"
          onClick={swap}
          disabled={config.sourceLang === 'auto'}
          title={t('互换语言')}
          className="rounded-full border border-line bg-card p-2 text-ink-3 shadow-sm transition-colors hover:text-brand-hi disabled:opacity-40"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </button>
        <Select
          variant="field"
          className="w-44"
          value={config.targetLang}
          onChange={(v) => update({ targetLang: v })}
          options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
            value: l.code,
            label: l.label,
          }))}
        />
      </div>

      {/* panes */}
      <div className={`grid gap-4 ${compareOn ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div className={paneCls}>
          <textarea
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder={t('输入要翻译的文本') + '…'}
            className="h-64 w-full resize-none bg-transparent text-[15px] leading-7 text-ink outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center justify-between border-t border-line/70 pt-2 text-xs text-ink-3">
            <span className="tabular-nums">
              {source.length} {t('字符')}
            </span>
            <div className="flex gap-0.5">
              <PaneAction title={t('朗读')} onClick={() => speak(source, config.sourceLang)}>
                <Volume2 className="h-3.5 w-3.5" />
              </PaneAction>
              <PaneAction
                title={t('清空')}
                onClick={() => {
                  setSource('');
                  setResult('');
                  setCompareResult('');
                }}
              >
                <Eraser className="h-3.5 w-3.5" />
              </PaneAction>
            </div>
          </div>
        </div>

        <div className={paneCls}>
          <div className="h-64 w-full overflow-auto whitespace-pre-wrap text-[15px] leading-7 text-ink">
            {result || (
              <span className="text-ink-3">
                {translating ? t('翻译中') + '…' : t('译文将显示在这里')}
              </span>
            )}
            {translating && result && <span className="animate-pulse text-brand">▍</span>}
          </div>
          <div className="flex items-center justify-between border-t border-line/70 pt-2 text-xs text-ink-3">
            <span>
              {compareOn
                ? (PROVIDER_LIST.find((p) => p.id === config.provider)?.name ?? config.provider)
                : langLabel(config.targetLang)}
            </span>
            <div className="flex gap-0.5">
              <PaneAction title={t('朗读')} onClick={() => speak(result, config.targetLang)}>
                <Volume2 className="h-3.5 w-3.5" />
              </PaneAction>
              <PaneAction title={t('复制')} onClick={() => copyText(result)}>
                <Copy className="h-3.5 w-3.5" />
              </PaneAction>
            </div>
          </div>
        </div>

        {compareOn && (
          <div className={`${paneCls} ring-1 ring-brand/15`}>
            <div className="h-64 w-full overflow-auto whitespace-pre-wrap text-[15px] leading-7 text-ink">
              {compareResult || (
                <span className="text-ink-3">
                  {compareTranslating ? t('翻译中') + '…' : t('对比译文将显示在这里')}
                </span>
              )}
              {compareTranslating && compareResult && (
                <span className="animate-pulse text-brand">▍</span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line/70 pt-2 text-xs text-ink-3">
              <span>
                {PROVIDER_LIST.find((p) => p.id === effectiveCompare)?.name ?? effectiveCompare}
              </span>
              <PaneAction title={t('复制')} onClick={() => copyText(compareResult)}>
                <Copy className="h-3.5 w-3.5" />
              </PaneAction>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <Button
          variant="primary"
          className="px-10"
          disabled={translating || !source.trim()}
          loading={translating}
          onClick={() => doTranslate(source)}
        >
          {translating ? t('翻译中') + '…' : t('翻译')}
        </Button>
      </div>

      {/* history drawer */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/20 animate-fade-in"
            onClick={() => setShowHistory(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-40 flex w-96 max-w-[90vw] flex-col border-l border-line bg-card shadow-overlay animate-slide-up">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {t('历史记录')}
                <span className="ml-2 text-xs font-normal text-ink-3">{history.length}</span>
              </h2>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-ink-3 transition-colors hover:text-danger"
                  onClick={async () => {
                    await browser.storage.local.remove(HISTORY_KEY);
                    setHistory([]);
                  }}
                >
                  {t('清空历史')}
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 text-ink-3 transition-colors hover:bg-fill hover:text-ink"
                  onClick={() => setShowHistory(false)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {history.length === 0 && (
                <p className="p-2 text-sm text-ink-3">{t('暂无历史记录')}</p>
              )}
              {history.map((h) => (
                <button
                  type="button"
                  key={h.id}
                  onClick={() => {
                    setSource(h.source);
                    setResult(h.result);
                    setShowHistory(false);
                  }}
                  className="block w-full rounded-md border border-line px-3.5 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-fill"
                >
                  <div className="mb-1 line-clamp-1 text-sm text-ink">{h.source}</div>
                  <div className="line-clamp-1 text-xs text-ink-3">{h.result}</div>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
