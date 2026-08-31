import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { Eraser, Send, Square } from 'lucide-react';
import { useToast } from '../../src/components/ui';
import { t } from '../../src/core/i18n';
import {
  sendToTab,
  streamPageChat,
  type PageChatTurn,
} from '../../src/core/messaging';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
}

/** Side-panel page Q&A: ask the AI about the page in the active tab. */
export default function PageChat() {
  const toast = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;

    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id == null) return;
    let page: { title: string; url: string; text: string };
    try {
      page = await sendToTab(tab.id, 'getPageText', undefined);
    } catch {
      toast(t('无法读取页面内容，请在普通网页中使用'), 'error');
      return;
    }
    if (!page.text) {
      toast(t('无法读取页面内容，请在普通网页中使用'), 'error');
      return;
    }

    // History = prior completed Q&A turns (skip failed answers).
    const history: PageChatTurn[] = messages
      .filter((m) => !m.error && m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    setInput('');
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: q },
      { role: 'assistant', content: '' },
    ]);

    const patchLast = (patch: (m: ChatMsg) => ChatMsg) =>
      setMessages((prev) => {
        const next = prev.slice();
        const last = next[next.length - 1];
        if (last?.role === 'assistant') next[next.length - 1] = patch(last);
        return next;
      });

    cancelRef.current = streamPageChat({ question: q, history, page }, (ev) => {
      if (ev.kind === 'delta') {
        patchLast((m) => ({ ...m, content: m.content + ev.text }));
      } else if (ev.kind === 'done') {
        patchLast((m) => ({ ...m, content: ev.full }));
        setBusy(false);
        cancelRef.current = null;
      } else {
        patchLast((m) => ({
          ...m,
          content: m.content || ev.message,
          error: true,
        }));
        setBusy(false);
        cancelRef.current = null;
      }
    });
  };

  const stop = () => {
    cancelRef.current?.();
    cancelRef.current = null;
    setBusy(false);
    // Keep whatever streamed in; mark clearly if nothing arrived.
    setMessages((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (last?.role === 'assistant' && !last.content) {
        next[next.length - 1] = { ...last, content: t('已停止'), error: true };
      }
      return next;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="mt-8 space-y-3 text-center">
            <p className="text-xs text-ink-3">
              {t('基于当前页面内容进行 AI 总结与问答')}
            </p>
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="rounded-full border border-line bg-card px-4 py-1.5 text-xs text-ink-2 transition-colors hover:border-brand hover:text-brand"
                onClick={() => void send(t('请总结这个页面的主要内容'))}
              >
                {t('总结这个页面')}
              </button>
              <button
                type="button"
                className="rounded-full border border-line bg-card px-4 py-1.5 text-xs text-ink-2 transition-colors hover:border-brand hover:text-brand"
                onClick={() => void send(t('请提炼这个页面的关键要点，用列表呈现'))}
              >
                {t('提炼关键要点')}
              </button>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3 py-2 text-xs leading-relaxed text-white'
                    : m.error
                      ? 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600'
                      : 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-fill px-3 py-2 text-xs leading-relaxed text-ink'
                }
              >
                {m.content || (
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3 [animation-delay:300ms]" />
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-line bg-card px-3 py-2.5">
        <div className="flex items-end gap-2">
          {messages.length > 0 && (
            <button
              type="button"
              title={t('清空对话')}
              onClick={() => {
                stop();
                setMessages([]);
              }}
              className="rounded-md p-2 text-ink-3 transition-colors hover:bg-fill hover:text-ink"
            >
              <Eraser size={15} />
            </button>
          )}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t('针对当前页面提问…')}
            className="max-h-24 min-h-[36px] flex-1 resize-none rounded-lg border border-line bg-bg px-3 py-2 text-xs text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-brand"
          />
          {busy ? (
            <button
              type="button"
              title={t('停止')}
              onClick={stop}
              className="rounded-lg bg-fill p-2 text-ink-2 transition-colors hover:text-ink"
            >
              <Square size={15} />
            </button>
          ) : (
            <button
              type="button"
              title={t('发送')}
              disabled={!input.trim()}
              onClick={() => void send(input)}
              className="rounded-lg bg-brand p-2 text-white transition-opacity disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
