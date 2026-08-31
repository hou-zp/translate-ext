import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button, Segmented, useToast } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import { t } from '../../src/core/i18n';
import { sendToTab } from '../../src/core/messaging';
import TextApp from '../text-translate/App';
import PageChat from './PageChat';

interface PageState {
  translated: boolean;
  total: number;
  done: number;
}

/**
 * Persistent side panel: quick controls for the current page on top,
 * the full text-translate UI (with engine compare) below. The text app
 * collapses to a single column at this width.
 */
export default function App() {
  const { config } = useConfig();
  const toast = useToast();
  const [tabId, setTabId] = useState<number | null>(null);
  const [pageTitle, setPageTitle] = useState('');
  const [state, setState] = useState<PageState | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'translate' | 'chat'>('translate');

  const refresh = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return;
    setTabId(tab.id);
    setPageTitle(tab.title ?? '');
    try {
      setState(await sendToTab(tab.id, 'getPageState', undefined));
    } catch {
      setState(null); // content script unavailable (chrome:// pages etc.)
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    const onActivated = () => void refresh();
    browser.tabs.onActivated.addListener(onActivated);
    return () => {
      clearInterval(timer);
      browser.tabs.onActivated.removeListener(onActivated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePage = async () => {
    if (tabId == null) return;
    setBusy(true);
    try {
      await sendToTab(tabId, 'translatePage', undefined);
      await refresh();
    } catch {
      toast(t('此页面不支持翻译，请在普通网页中使用'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!config) return null;

  const progress =
    state && state.total > 0 ? Math.round((state.done / state.total) * 100) : null;

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-line bg-card px-4 py-3 shadow-card">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-3">{t('当前页面')}</span>
          <span className="max-w-[60%] truncate text-xs text-ink-3" title={pageTitle}>
            {pageTitle}
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full !py-2.5 !text-sm"
          disabled={busy || state === null}
          loading={busy}
          onClick={togglePage}
        >
          {state === null
            ? t('此页面不支持翻译，请在普通网页中使用')
            : busy
              ? t('正在翻译') + '…'
              : state.translated
                ? t('显示原文')
                : t('翻译当前页面')}
        </Button>
        {state?.translated && progress !== null && progress < 100 && (
          <div className="mt-2 flex items-center gap-2 animate-fade-in">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill">
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-ink-3">
              {state.done}/{state.total}
            </span>
          </div>
        )}
        <Segmented
          className="mt-2.5"
          value={view}
          onChange={(v) => setView(v as 'translate' | 'chat')}
          options={[
            { value: 'translate', label: t('文本翻译') },
            { value: 'chat', label: t('页面问答') },
          ]}
        />
      </div>
      {/* Both panels stay mounted so switching tabs never loses state. */}
      <div className={view === 'translate' ? 'flex-1 overflow-y-auto' : 'hidden'}>
        <TextApp />
      </div>
      <div className={view === 'chat' ? 'min-h-0 flex-1' : 'hidden'}>
        <PageChat />
      </div>
    </div>
  );
}
