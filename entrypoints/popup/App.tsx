import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import {
  ArrowRightLeft,
  BookImage,
  BookMarked,
  Captions,
  ChevronDown,
  Eraser,
  FileText,
  Globe,
  Keyboard,
  ListChecks,
  MousePointer2,
  PanelRight,
  PencilLine,
  Plug,
  Settings,
  Sparkles,
  TextSelect,
  Type,
} from 'lucide-react';
import { useConfig } from '../../src/components/useConfig';
import { Button, Segmented, Select, Toggle, useToast } from '../../src/components/ui';
import { siteMode } from '../../src/core/config';
import { t } from '../../src/core/i18n';
import { LANGS } from '../../src/core/langs';
import { sendToBackground, sendToTab } from '../../src/core/messaging';
import { allExperts } from '../../src/core/prompts';
import { PROVIDER_LIST } from '../../src/providers';

/** Close the popup — works both as a toolbar popup and embedded in the float-ball iframe. */
function closeSelf() {
  if (window.parent !== window) {
    window.parent.postMessage({ __txe: 'close-panel' }, '*');
  } else {
    window.close();
  }
}

export default function App() {
  const { config, update } = useConfig();
  const toast = useToast();
  const [pageTranslated, setPageTranslated] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [siteHost, setSiteHost] = useState('');
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement>(null);
  const version = browser.runtime.getManifest().version;

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return;
      setActiveTabId(tab.id);
      try {
        setSiteHost(new URL(tab.url ?? '').hostname);
      } catch {
        // chrome:// pages etc.
      }
      try {
        const state = await sendToTab(tab.id, 'getPageState', undefined);
        setPageTranslated(state.translated);
        if (state.translated && state.total > 0) {
          setProgress({ done: state.done, total: state.total });
        }
      } catch {
        // content script unavailable on this page
      }
    });
  }, []);

  // Poll page progress while translating.
  useEffect(() => {
    if (!busy || activeTabId == null) return;
    const timer = setInterval(async () => {
      try {
        const s = await sendToTab(activeTabId, 'getPageState', undefined);
        if (s.total > 0) setProgress({ done: s.done, total: s.total });
      } catch {
        // ignore
      }
    }, 400);
    return () => clearInterval(timer);
  }, [busy, activeTabId]);

  useEffect(() => {
    if (!siteMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!siteMenuRef.current?.contains(e.target as Node)) setSiteMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [siteMenuOpen]);

  if (!config) return <div className="w-[360px] p-6 text-sm text-ink-3">…</div>;

  const experts = allExperts(config);
  const currentSiteMode = siteHost ? siteMode(config, siteHost) : 'normal';

  const translatePage = async () => {
    if (activeTabId == null) return;
    setBusy(true);
    try {
      const res = await sendToTab(activeTabId, 'translatePage', undefined);
      setPageTranslated(res.translated);
      if (res.translated) closeSelf();
    } catch {
      toast(t('此页面不支持翻译，请在普通网页中使用'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const openPage = (page: 'pdf-viewer' | 'text-translate' | 'options' | 'shortcuts') => {
    void sendToBackground('openPage', { page });
    closeSelf();
  };

  const setSiteList = (mode: 'always' | 'never') => {
    if (!siteHost) return;
    const inAlways = config.autoTranslateSites.includes(siteHost);
    const inNever = config.neverTranslateSites.includes(siteHost);
    const strip = (list: string[]) => list.filter((s) => s !== siteHost);
    if (mode === 'always') {
      update({
        autoTranslateSites: inAlways
          ? strip(config.autoTranslateSites)
          : [...strip(config.autoTranslateSites), siteHost],
        neverTranslateSites: strip(config.neverTranslateSites),
      });
    } else {
      update({
        neverTranslateSites: inNever
          ? strip(config.neverTranslateSites)
          : [...strip(config.neverTranslateSites), siteHost],
        autoTranslateSites: strip(config.autoTranslateSites),
      });
    }
  };

  const swapLangs = () => {
    if (config.sourceLang === 'auto') return;
    update({ sourceLang: config.targetLang, targetLang: config.sourceLang });
  };

  const featureBtn = (active: boolean) =>
    `flex items-center gap-2 rounded-md border px-3.5 py-3 text-[13px] transition-colors duration-150 ${
      active
        ? 'border-brand/50 bg-brand-soft text-brand-hi'
        : 'border-line bg-card/80 text-ink-2 hover:border-line-strong hover:bg-fill/60 hover:text-ink'
    }`;

  const moreBtn = (active?: boolean) =>
    `flex flex-col items-center gap-1.5 rounded-md px-1 py-2.5 text-[11px] transition-colors duration-150 ${
      active ? 'bg-brand-soft text-brand-hi' : 'bg-fill/60 text-ink-2 hover:bg-fill-2 hover:text-ink'
    }`;

  return (
    <div className="w-[360px] bg-surface text-ink">
      {/* brand bar */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/icon/32.png" alt="" className="h-5 w-5 shrink-0" />
          <span className="truncate font-display text-sm font-bold tracking-wide">AI 沉浸翻译</span>
        </div>
        {siteHost && (
          <div ref={siteMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setSiteMenuOpen((v) => !v)}
              className={`flex max-w-40 items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[10.5px] transition-colors ${
                currentSiteMode === 'never'
                  ? 'bg-danger/10 text-danger'
                  : currentSiteMode === 'always'
                    ? 'bg-brand-soft text-brand-hi'
                    : 'bg-fill/60 text-ink-3 hover:bg-fill-2 hover:text-ink-2'
              }`}
            >
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{siteHost.replace(/^www\./, '')}</span>
              <ChevronDown className="h-3 w-3 shrink-0" />
            </button>
            {siteMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-44 rounded-md border border-line-strong bg-card p-1 shadow-popover animate-pop-in">
                <button
                  type="button"
                  onClick={() => setSiteList('always')}
                  className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-ink-2 hover:bg-fill/60"
                >
                  {t('自动翻译此站')}
                  <Toggle
                    checked={currentSiteMode === 'always'}
                    onChange={() => setSiteList('always')}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setSiteList('never')}
                  className="flex w-full items-center justify-between rounded px-2.5 py-2 text-xs text-ink-2 hover:bg-fill/60"
                >
                  {t('永不翻译此站')}
                  <Toggle
                    checked={currentSiteMode === 'never'}
                    onChange={() => setSiteList('never')}
                  />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-4">
        {/* main action */}
        <div className="mb-3 rounded-lg border border-line bg-card/80 p-3 shadow-card">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={busy}
            onClick={translatePage}
          >
            {busy
              ? t('正在翻译') + '…'
              : pageTranslated
                ? t('显示原文')
                : t('翻译当前页面')}
          </Button>
          {busy && progress && progress.total > 0 && (
            <div className="mt-2.5 flex items-center gap-2 animate-fade-in">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill-2">
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <span className="font-mono text-[10.5px] tabular-nums text-ink-3">
                {progress.done}/{progress.total}
              </span>
            </div>
          )}
          <Segmented
            className="mt-2.5"
            value={config.displayMode}
            onChange={(v) => update({ displayMode: v as typeof config.displayMode })}
            options={[
              { value: 'bilingual', label: t('双语对照') },
              { value: 'replace', label: t('替换原文') },
            ]}
          />
        </div>

        {/* language pair + service */}
        <div className="mb-3 rounded-lg border border-line bg-card/80 px-4 py-1 shadow-card">
          <div className="flex items-center gap-2 py-3">
            <Select
              className="min-w-0 flex-1"
              value={config.sourceLang}
              onChange={(v) => update({ sourceLang: v })}
              options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
            />
            <button
              type="button"
              title={t('互换语言')}
              onClick={swapLangs}
              disabled={config.sourceLang === 'auto'}
              className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-fill/60 hover:text-brand-hi disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
            <Select
              className="min-w-0 flex-1"
              value={config.targetLang}
              onChange={(v) => update({ targetLang: v })}
              options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
                value: l.code,
                label: l.label,
              }))}
            />
          </div>
          <div className="border-t border-line" />
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <Plug className="h-4 w-4 text-ink-3" />
              {t('翻译服务')}
            </span>
            <Select
              value={config.provider}
              onChange={(v) => update({ provider: v as typeof config.provider })}
              options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
          <div className="border-t border-line" />
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <Sparkles className="h-4 w-4 text-ink-3" />
              {t('AI 专家')}
            </span>
            <Select
              value={config.expertId}
              onChange={(v) => update({ expertId: v })}
              options={experts.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>
          <div className="border-t border-line" />
          <div className="flex items-center justify-between py-3">
            <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
              <Sparkles className="h-4 w-4 text-ink-3" />
              {t('启用 AI 精翻')}
            </span>
            <Toggle
              checked={config.refineEnabled}
              onChange={(v) => update({ refineEnabled: v })}
            />
          </div>
        </div>

        {/* feature grid */}
        <div className="mb-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => openPage('pdf-viewer')} className={featureBtn(false)}>
            <FileText className="h-4 w-4 text-brand-hi" />
            {t('文档翻译')}
          </button>
          <button
            type="button"
            onClick={() => openPage('text-translate')}
            className={featureBtn(false)}
          >
            <Type className="h-4 w-4 text-brand-hi" />
            {t('文本翻译')}
          </button>
          <button
            type="button"
            onClick={() => update({ hoverEnabled: !config.hoverEnabled })}
            className={featureBtn(config.hoverEnabled)}
          >
            <MousePointer2 className="h-4 w-4" />
            {t('鼠标悬停')}
          </button>
          <button
            type="button"
            onClick={() => update({ selectionEnabled: !config.selectionEnabled })}
            className={featureBtn(config.selectionEnabled)}
          >
            <TextSelect className="h-4 w-4" />
            {t('划词翻译')}
          </button>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-line pt-3 font-mono text-[10.5px] text-ink-3">
          <button
            type="button"
            onClick={() => openPage('options')}
            className="flex items-center gap-1 transition-colors hover:text-ink"
          >
            <Settings className="h-3.5 w-3.5" />
            {t('设置')}
          </button>
          <span className="tracking-[0.14em]">v{version}</span>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center gap-1 transition-colors hover:text-ink"
          >
            {t('更多功能')}
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {moreOpen && (
          <div className="mt-2.5 grid grid-cols-4 gap-2 animate-collapse-in">
            <button
              type="button"
              onClick={() => update({ inputTranslateEnabled: !config.inputTranslateEnabled })}
              className={moreBtn(config.inputTranslateEnabled)}
            >
              <PencilLine className="h-4 w-4" />
              {t('输入框翻译')}
            </button>
            <button
              type="button"
              onClick={() => update({ youtubeSubtitlesEnabled: !config.youtubeSubtitlesEnabled })}
              className={moreBtn(config.youtubeSubtitlesEnabled)}
            >
              <Captions className="h-4 w-4" />
              {t('YouTube 字幕')}
            </button>
            <button
              type="button"
              onClick={() => {
                void browser.tabs.create({
                  url: browser.runtime.getURL('/options.html') + '#terms',
                });
                closeSelf();
              }}
              className={moreBtn()}
            >
              <BookMarked className="h-4 w-4" />
              {t('术语库')}
            </button>
            <button
              type="button"
              onClick={async () => {
                await sendToBackground('clearCache', undefined);
                toast(t('清空缓存') + ' ✓', 'success');
              }}
              className={moreBtn()}
            >
              <Eraser className="h-4 w-4" />
              {t('清空缓存')}
            </button>
            <button type="button" onClick={() => openPage('shortcuts')} className={moreBtn()}>
              <Keyboard className="h-4 w-4" />
              {t('快捷键')}
            </button>
            <button
              type="button"
              onClick={() => {
                void browser.tabs.create({
                  url: browser.runtime.getURL('/options.html') + '#sites',
                });
                closeSelf();
              }}
              className={moreBtn()}
            >
              <ListChecks className="h-4 w-4" />
              {t('站点规则')}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (activeTabId == null) return;
                try {
                  const res = await sendToTab(activeTabId, 'mangaMode', undefined);
                  toast(
                    res.active
                      ? `${t('已开启漫画模式')} · ${res.images} ${t('张图片')}`
                      : t('已关闭漫画模式'),
                    'success',
                  );
                  if (res.active) closeSelf();
                } catch {
                  toast(t('此页面不支持翻译，请在普通网页中使用'), 'error');
                }
              }}
              className={moreBtn()}
            >
              <BookImage className="h-4 w-4" />
              {t('漫画模式')}
            </button>
            <button
              type="button"
              onClick={async () => {
                const sidePanel = (
                  browser as unknown as {
                    sidePanel?: { open: (opts: { tabId: number }) => Promise<void> };
                  }
                ).sidePanel;
                if (!sidePanel || activeTabId == null) {
                  toast(t('此浏览器不支持侧边栏'), 'error');
                  return;
                }
                try {
                  await sidePanel.open({ tabId: activeTabId });
                  closeSelf();
                } catch {
                  toast(t('此浏览器不支持侧边栏'), 'error');
                }
              }}
              className={moreBtn()}
            >
              <PanelRight className="h-4 w-4" />
              {t('侧边栏')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
