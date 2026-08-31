import { browser } from 'wxt/browser';
import type { ProviderId } from './config';

// ---------------------------------------------------------------------------
// Typed message protocol between popup / options / pages / content <-> background
// ---------------------------------------------------------------------------

export interface BatchItemError {
  code: 'auth' | 'quota' | 'network' | 'ollama-offline' | 'parse' | 'other';
  message: string;
}

export interface TranslateBatchReq {
  texts: string[];
  from: string;
  to: string;
  provider?: ProviderId;
  expertId?: string;
  noCache?: boolean;
  /** Shared document context injected into AI prompts for consistency */
  context?: string;
}

export interface TranslateBatchRes {
  results: (string | null)[];
  errors: (BatchItemError | null)[];
}

export interface RefineBatchReq {
  originals: string[];
  drafts: string[];
  from: string;
  to: string;
  expertId?: string;
  /** Shared document context injected into AI prompts for consistency */
  context?: string;
}

export interface ProviderTestRes {
  ok: boolean;
  message: string;
  models?: string[];
}

export type BgProtocol = {
  translateBatch: { req: TranslateBatchReq; res: TranslateBatchRes };
  refineBatch: { req: RefineBatchReq; res: TranslateBatchRes };
  detectLanguage: { req: { text: string }; res: { lang: string } };
  testProvider: { req: { provider: ProviderId }; res: ProviderTestRes };
  listModels: { req: { provider: ProviderId }; res: { models: string[] } };
  openPage: {
    req: { page: 'options' | 'pdf-viewer' | 'text-translate' | 'shortcuts' };
    res: void;
  };
  getCacheStats: { req: void; res: { entries: number; chars: number } };
  clearCache: { req: void; res: void };
  /** Summarize a page/document so batches can share context */
  buildPageContext: {
    req: { title: string; sample: string; to: string };
    res: { context: string };
  };
  /** OCR + translate an image via a multimodal model */
  translateImage: {
    req: { srcUrl: string; to: string };
    res: { text: string };
  };
};

export type CsProtocol = {
  translatePage: { req: void; res: { translated: boolean } };
  restorePage: { req: void; res: void };
  getPageState: { req: void; res: { translated: boolean; total: number; done: number } };
  translateSelection: { req: { text?: string }; res: void };
  translateImage: { req: { srcUrl: string }; res: void };
  /** Toggle experimental manga mode (batch image translation overlays) */
  mangaMode: { req: void; res: { active: boolean; images: number } };
  ping: { req: void; res: { pong: true } };
};

interface Envelope {
  __tx: true;
  scope: 'bg' | 'cs';
  type: string;
  payload: unknown;
}

interface ReplyEnvelope {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function makeSender(scope: 'bg' | 'cs') {
  return (type: string, payload: unknown) => ({ __tx: true, scope, type, payload }) as Envelope;
}

export function sendToBackground<K extends keyof BgProtocol>(
  type: K,
  payload: BgProtocol[K]['req'],
): Promise<BgProtocol[K]['res']> {
  return browser.runtime
    .sendMessage(makeSender('bg')(type as string, payload))
    .then((reply: ReplyEnvelope) => {
      if (!reply) throw new Error('no reply from background');
      if (!reply.ok) throw new Error(reply.error ?? 'unknown error');
      return reply.data as BgProtocol[K]['res'];
    });
}

export function sendToTab<K extends keyof CsProtocol>(
  tabId: number,
  type: K,
  payload: CsProtocol[K]['req'],
): Promise<CsProtocol[K]['res']> {
  return browser.tabs
    .sendMessage(tabId, makeSender('cs')(type as string, payload))
    .then((reply: ReplyEnvelope) => {
      if (!reply) throw new Error('no reply from content script');
      if (!reply.ok) throw new Error(reply.error ?? 'unknown error');
      return reply.data as CsProtocol[K]['res'];
    });
}

type HandlerMap<P extends Record<string, { req: unknown; res: unknown }>> = {
  [K in keyof P]: (
    payload: P[K]['req'],
    sender: { tab?: { id?: number } },
  ) => Promise<P[K]['res']> | P[K]['res'];
};

function listen<P extends Record<string, { req: unknown; res: unknown }>>(
  scope: 'bg' | 'cs',
  handlers: Partial<HandlerMap<P>>,
) {
  browser.runtime.onMessage.addListener(
    (msg: unknown, sender: unknown, sendResponse: (r: ReplyEnvelope) => void) => {
      const m = msg as Envelope;
      if (!m || m.__tx !== true || m.scope !== scope) return;
      const handler = handlers[m.type as keyof P];
      if (!handler) return;
      Promise.resolve(handler(m.payload as never, sender as { tab?: { id?: number } }))
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        );
      return true; // async response
    },
  );
}

export function onBackgroundMessage(handlers: Partial<HandlerMap<BgProtocol>>) {
  listen<BgProtocol>('bg', handlers);
}

export function onContentMessage(handlers: Partial<HandlerMap<CsProtocol>>) {
  listen<CsProtocol>('cs', handlers);
}

// ---------------------------------------------------------------------------
// Streaming translation over a long-lived port (used by the text translate page)
// ---------------------------------------------------------------------------

export const STREAM_PORT_NAME = 'tx-stream';

export interface StreamTranslateReq {
  text: string;
  from: string;
  to: string;
  provider?: ProviderId;
  expertId?: string;
}

export type StreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'done'; full: string }
  | { kind: 'error'; message: string };

/**
 * Stream a translation from the background. Falls back to a single 'done'
 * event when the provider does not support streaming.
 */
export function streamTranslate(
  req: StreamTranslateReq,
  onEvent: (ev: StreamEvent) => void,
): () => void {
  const port = browser.runtime.connect({ name: STREAM_PORT_NAME });
  port.onMessage.addListener((ev: unknown) => {
    const e = ev as StreamEvent;
    onEvent(e);
    if (e.kind === 'done' || e.kind === 'error') {
      try {
        port.disconnect();
      } catch {
        /* already closed */
      }
    }
  });
  port.postMessage(req);
  return () => {
    try {
      port.disconnect();
    } catch {
      /* noop */
    }
  };
}
