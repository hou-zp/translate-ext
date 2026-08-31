import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useToast } from '../../src/components/ui';
import { useConfig } from '../../src/components/useConfig';
import { t } from '../../src/core/i18n';
import { sendToTab } from '../../src/core/messaging';
import TextApp from '../text-translate/App';

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
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-500">{t('当前页面')}</span>
          <span className="max-w-[60%] truncate text-xs text-gray-400" title={pageTitle}>
            {pageTitle}
          </span>
        </div>
        <button
          type="button"
          disabled={busy || state === null}
          onClick={togglePage}
          className="w-full rounded-xl bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-dark disabled:opacity-50"
        >
          {state === null
            ? t('此页面不支持翻译，请在普通网页中使用')
            : busy
              ? t('正在翻译') + '…'
              : state.translated
                ? t('显示原文')
                : t('翻译当前页面')}
        </button>
        {state?.translated && progress !== null && progress < 100 && (
          <div className="mt-2 h-1 overflow-hidden rounded bg-gray-100">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      <TextApp />
    </div>
  );
}
