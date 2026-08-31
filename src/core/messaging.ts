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
  /**
   * Manga-style region translation: detect text regions, erase the original
   * text and repaint the translation in place. Returns the repainted image as
   * a data URL, or `fallbackText` when the model could not produce regions.
   */
  translateMangaImage: {
    req: { srcUrl: string; to: string };
    res: { regions: MangaRegion[]; dataUrl?: string; fallbackText?: string };
  };
};

/** A detected comic text region, coordinates normalized to image size (0-1). */
export interface MangaRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  translation: string;
}

/** Messages handled by the offscreen document (Chromium only, local ONNX). */
export type OffProtocol = {
  /** Detect text regions in an image with the local ONNX detector */
  detectTextRegions: {
    req: { dataUrl: string; modelUrl: string };
    res: { boxes: { x: number; y: number; w: number; h: number }[] };
  };
};

export type CsProtocol = {
  translatePage: { req: void; res: { translated: boolean } };
  restorePage: { req: void; res: void };
  getPageState: { req: void; res: { translated: boolean; total: number; done: number } };
  /** Readable page text for the side-panel Q&A (handled in the top frame only) */
  getPageText: { req: void; res: { title: string; url: string; text: string } };
  translateSelection: { req: { text?: string }; res: void };
  translateImage: { req: { srcUrl: string }; res: void };
  /** Repaint a single image with translations filled into its text regions */
  translateImageFill: { req: { srcUrl: string }; res: void };
  /** Toggle experimental manga mode (batch image translation overlays) */
  mangaMode: { req: void; res: { active: boolean; images: number } };
  ping: { req: void; res: { pong: true } };
};

interface Envelope {
  __tx: true;
  scope: 'bg' | 'cs' | 'off';
  type: string;
  payload: unknown;
}

interface ReplyEnvelope {
  ok: boolean;
  data?: unknown;
  error?: string;
}

function makeSender(scope: 'bg' | 'cs' | 'off') {
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
  scope: 'bg' | 'cs' | 'off',
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

export function sendToOffscreen<K extends keyof OffProtocol>(
  type: K,
  payload: OffProtocol[K]['req'],
): Promise<OffProtocol[K]['res']> {
  return browser.runtime
    .sendMessage(makeSender('off')(type as string, payload))
    .then((reply: ReplyEnvelope) => {
      if (!reply) throw new Error('no reply from offscreen document');
      if (!reply.ok) throw new Error(reply.error ?? 'unknown error');
      return reply.data as OffProtocol[K]['res'];
    });
}

export function onOffscreenMessage(handlers: Partial<HandlerMap<OffProtocol>>) {
  listen<OffProtocol>('off', handlers);
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

// ---------------------------------------------------------------------------
// Page Q&A chat over a long-lived port (used by the side panel)
// ---------------------------------------------------------------------------

export const PAGE_CHAT_PORT_NAME = 'tx-page-chat';

export interface PageChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PageChatReq {
  question: string;
  /** Prior turns of this conversation (already answered) */
  history: PageChatTurn[];
  page: { title: string; url: string; text: string };
}

/**
 * Ask the AI a question about a page, streaming the answer. Returns a cancel
 * function that disconnects the port.
 */
export function streamPageChat(
  req: PageChatReq,
  onEvent: (ev: StreamEvent) => void,
): () => void {
  const port = browser.runtime.connect({ name: PAGE_CHAT_PORT_NAME });
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
