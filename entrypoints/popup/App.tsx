import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useConfig } from '../../src/components/useConfig';
import { Select, Toggle, useToast } from '../../src/components/ui';
import { t } from '../../src/core/i18n';
import { LANGS } from '../../src/core/langs';
import { sendToBackground, sendToTab } from '../../src/core/messaging';
import { allExperts } from '../../src/core/prompts';
import { PROVIDER_LIST } from '../../src/providers';

function Icon(props: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? 'h-4.5 w-4.5'}
    >
      <path d={props.d} />
    </svg>
  );
}

const ICONS = {
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M9 13h6M9 17h6',
  text: 'M4 7V5h16v2M12 5v14M9 19h6',
  hover: 'M4 4l7 17 2.5-7.5L21 11zM15 15l5 5',
  select: 'M9 3H5a2 2 0 0 0-2 2v4m0 6v4a2 2 0 0 0 2 2h4m6-18h4a2 2 0 0 1 2 2v4m0 6v4a2 2 0 0 1-2 2h-4',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z',
  plug: 'M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5',
  page: 'M9 12h6M9 16h4M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM15 3v5h5',
};

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
  const [busy, setBusy] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const version = browser.runtime.getManifest().version;

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
      if (tab?.id == null) return;
      setActiveTabId(tab.id);
      try {
        const state = await sendToTab(tab.id, 'getPageState', undefined);
        setPageTranslated(state.translated);
      } catch {
        // content script unavailable on this page
      }
    });
  }, []);

  if (!config) return <div className="w-[360px] p-6 text-sm text-gray-400">…</div>;

  const experts = allExperts(config);

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

  const rowCls =
    'flex items-center justify-between rounded-xl bg-gray-100/80 px-4 py-3';

  return (
    <div className="w-[360px] bg-white p-4 text-gray-900">
      {/* language pair */}
      <div className="mb-2.5 flex items-center gap-2">
        <div className="flex-1 rounded-xl bg-gray-100/80 px-3 py-3">
          <Select
            className="w-full font-medium"
            value={config.sourceLang}
            onChange={(v) => update({ sourceLang: v })}
            options={LANGS.map((l) => ({ value: l.code, label: l.label }))}
          />
        </div>
        <Icon d="M5 12h14M13 6l6 6-6 6" className="h-4 w-4 shrink-0 text-gray-500" />
        <div className="flex-1 rounded-xl bg-gray-100/80 px-3 py-3">
          <Select
            className="w-full font-medium"
            value={config.targetLang}
            onChange={(v) => update({ targetLang: v })}
            options={LANGS.filter((l) => l.code !== 'auto').map((l) => ({
              value: l.code,
              label: l.label,
            }))}
          />
        </div>
      </div>

      {/* service / expert / refine */}
      <div className="mb-3 overflow-hidden rounded-xl bg-gray-100/80">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-600">{t('翻译服务')}</span>
          <div className="flex items-center gap-1.5 text-gray-800">
            <Icon d={ICONS.plug} className="h-4 w-4 text-gray-500" />
            <Select
              value={config.provider}
              onChange={(v) => update({ provider: v as typeof config.provider })}
              options={PROVIDER_LIST.map((p) => ({ value: p.id, label: p.name }))}
            />
          </div>
        </div>
        <div className="mx-4 border-t border-gray-200/70" />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-600">{t('AI 专家')}</span>
          <div className="flex items-center gap-1.5 text-gray-800">
            <Icon d={ICONS.sparkle} className="h-4 w-4 text-gray-500" />
            <Select
              value={config.expertId}
              onChange={(v) => update({ expertId: v })}
              options={experts.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>
        </div>
        <div className="mx-4 border-t border-gray-200/70" />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-gray-600">{t('启用 AI 精翻')}</span>
          <Toggle
            checked={config.refineEnabled}
            onChange={(v) => update({ refineEnabled: v })}
          />
        </div>
      </div>

      {/* main action */}
      <div className="mb-3 flex items-stretch gap-2.5">
        <button
          type="button"
          title={config.displayMode === 'bilingual' ? '双语对照' : '译文替换'}
          onClick={() =>
            update({ displayMode: config.displayMode === 'bilingual' ? 'replace' : 'bilingual' })
          }
          className="flex w-12 items-center justify-center rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Icon d={ICONS.page} />
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={translatePage}
          className="flex-1 rounded-xl bg-brand py-3 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? t('正在翻译') + '…' : pageTranslated ? t('显示原文') : t('翻译当前页面')}
        </button>
      </div>

      {/* feature grid */}
      <div className="mb-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => openPage('pdf-viewer')}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Icon d={ICONS.doc} className="h-4.5 w-4.5 text-brand" />
          {t('文档翻译')}
        </button>
        <button
          type="button"
          onClick={() => openPage('text-translate')}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
        >
          <Icon d={ICONS.text} className="h-4.5 w-4.5 text-brand" />
          {t('文本翻译')}
        </button>
        <button
          type="button"
          onClick={() => update({ hoverEnabled: !config.hoverEnabled })}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            config.hoverEnabled
              ? 'border-brand/40 bg-blue-50 text-brand'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Icon d={ICONS.hover} className="h-4.5 w-4.5" />
          {t('鼠标悬停')}
        </button>
        <button
          type="button"
          onClick={() => update({ selectionEnabled: !config.selectionEnabled })}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            config.selectionEnabled
              ? 'border-brand/40 bg-blue-50 text-brand'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Icon d={ICONS.select} className="h-4.5 w-4.5" />
          {t('划词翻译')}
        </button>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
        <button
          type="button"
          onClick={() => openPage('options')}
          className="flex items-center gap-1 hover:text-gray-800"
        >
          <Icon d={ICONS.gear} className="h-3.5 w-3.5" />
          {t('设置')}
        </button>
        <span>v{version}</span>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="flex items-center gap-1 hover:text-gray-800"
        >
          {t('更多功能')}
          <Icon
            d="M6 9l6 6 6-6"
            className={`h-3 w-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {moreOpen && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => update({ inputTranslateEnabled: !config.inputTranslateEnabled })}
            className={`rounded-lg px-2 py-2 text-xs ${
              config.inputTranslateEnabled
                ? 'bg-blue-50 text-brand'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('输入框翻译')}
          </button>
          <button
            type="button"
            onClick={() => update({ youtubeSubtitlesEnabled: !config.youtubeSubtitlesEnabled })}
            className={`rounded-lg px-2 py-2 text-xs ${
              config.youtubeSubtitlesEnabled
                ? 'bg-blue-50 text-brand'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('YouTube 字幕')}
          </button>
          <button
            type="button"
            onClick={() => {
              void browser.tabs.create({ url: browser.runtime.getURL('/options.html') + '#terms' });
              closeSelf();
            }}
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
            {t('术语库')}
          </button>
          <button
            type="button"
            onClick={async () => {
              await sendToBackground('clearCache', undefined);
              toast(t('清空缓存') + ' ✓', 'success');
            }}
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
            {t('清空缓存')}
          </button>
          <button
            type="button"
            onClick={() => openPage('shortcuts')}
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
            {t('快捷键')}
          </button>
          <button
            type="button"
            onClick={() => openPage('options')}
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
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
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
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
            className="rounded-lg bg-gray-100 px-2 py-2 text-xs text-gray-600 hover:bg-gray-200"
          >
            {t('侧边栏')}
          </button>
        </div>
      )}
    </div>
  );
}
