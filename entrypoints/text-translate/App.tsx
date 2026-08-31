import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Select, useToast } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
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

  const copyResult = () => {
    void navigator.clipboard.writeText(result).then(() => toast('已复制', 'success'));
  };

  const speak = (text: string, lang: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'auto' ? '' : lang;
    speechSynthesis.speak(u);
  };

  if (!config) return null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">文本翻译</h1>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            翻译服务
            <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <Select
                value={config.provider}
                onChange={(v) => update({ provider: v as typeof config.provider })}
                options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
              />
            </span>
          </label>
          <label className="flex items-center gap-2 text-gray-600">
            AI 专家
            <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <Select
                value={config.expertId}
                onChange={(v) => update({ expertId: v })}
                options={allExperts(config).map((e) => ({ value: e.id, label: e.name }))}
              />
            </span>
          </label>
          <button
            type="button"
            onClick={() => {
              setCompareOn((v) => !v);
              if (!compareOn && source.trim()) doCompareTranslate(source.trim());
            }}
            className={`rounded-lg px-3 py-1.5 shadow-sm ${compareOn ? 'bg-brand text-white' : 'bg-white text-gray-600'}`}
          >
            双引擎对比
          </button>
          {compareOn && (
            <span className="rounded-lg bg-white px-3 py-1.5 shadow-sm">
              <Select
                value={effectiveCompare}
                onChange={(v) => {
                  setCompareProvider(v);
                  setCompareResult('');
                }}
                options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
              />
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className={`rounded-lg px-3 py-1.5 shadow-sm ${showHistory ? 'bg-brand text-white' : 'bg-white text-gray-600'}`}
          >
            历史记录
          </button>
        </div>
      </header>

      <div className="mb-3 flex items-center justify-center gap-3">
        <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
          <Select
            value={config.sourceLang}
            onChange={(v) => update({ sourceLang: v })}
            options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
          />
        </span>
        <button
          type="button"
          onClick={swap}
          disabled={config.sourceLang === 'auto'}
          title="互换语言"
          className="rounded-full bg-white p-2 text-gray-500 shadow-sm hover:text-brand disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M7 16l-4-4 4-4M3 12h18M17 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="rounded-lg bg-white px-4 py-2 shadow-sm">
          <Select
            value={config.targetLang}
            onChange={(v) => update({ targetLang: v })}
            options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
              value: l.code,
              label: l.label,
            }))}
          />
        </span>
      </div>

      <div className={`grid gap-4 ${compareOn ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <textarea
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="输入要翻译的文本…"
            className="h-64 w-full resize-none text-[15px] leading-7 text-gray-800 outline-none"
          />
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
            <span>{source.length} 字符</span>
            <div className="flex gap-2">
              <button type="button" className="hover:text-gray-700" onClick={() => speak(source, config.sourceLang)}>
                朗读
              </button>
              <button
                type="button"
                className="hover:text-gray-700"
                onClick={() => {
                  setSource('');
                  setResult('');
                }}
              >
                清空
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="h-64 w-full overflow-auto whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
            {result || (
              <span className="text-gray-300">
                {translating ? '翻译中…' : '译文将显示在这里'}
              </span>
            )}
            {translating && result && <span className="animate-pulse text-brand">▍</span>}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
            <span>
              {compareOn
                ? (PROVIDER_LIST.find((p) => p.id === config.provider)?.name ?? config.provider)
                : langLabel(config.targetLang)}
            </span>
            <div className="flex gap-2">
              <button type="button" className="hover:text-gray-700" onClick={() => speak(result, config.targetLang)}>
                朗读
              </button>
              <button type="button" className="hover:text-gray-700" onClick={copyResult}>
                复制
              </button>
            </div>
          </div>
        </div>

        {compareOn && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-brand/15">
            <div className="h-64 w-full overflow-auto whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
              {compareResult || (
                <span className="text-gray-300">
                  {compareTranslating ? '翻译中…' : '对比译文将显示在这里'}
                </span>
              )}
              {compareTranslating && compareResult && (
                <span className="animate-pulse text-brand">▍</span>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-400">
              <span>
                {PROVIDER_LIST.find((p) => p.id === effectiveCompare)?.name ?? effectiveCompare}
              </span>
              <button
                type="button"
                className="hover:text-gray-700"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(compareResult)
                    .then(() => toast('已复制', 'success'))
                }
              >
                复制
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={translating || !source.trim()}
          onClick={() => doTranslate(source)}
          className="rounded-xl bg-brand px-10 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {translating ? '翻译中…' : '翻译'}
        </button>
      </div>

      {showHistory && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-600">最近 {history.length} 条记录</h2>
            <button
              type="button"
              className="text-xs text-gray-400 hover:text-red-500"
              onClick={async () => {
                await browser.storage.local.remove(HISTORY_KEY);
                setHistory([]);
              }}
            >
              清空历史
            </button>
          </div>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-sm text-gray-400">暂无历史记录</p>}
            {history.map((h) => (
              <button
                type="button"
                key={h.id}
                onClick={() => {
                  setSource(h.source);
                  setResult(h.result);
                }}
                className="block w-full rounded-xl bg-white px-4 py-3 text-left shadow-sm hover:ring-1 hover:ring-brand/30"
              >
                <div className="mb-1 line-clamp-1 text-sm text-gray-800">{h.source}</div>
                <div className="line-clamp-1 text-xs text-gray-400">{h.result}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
