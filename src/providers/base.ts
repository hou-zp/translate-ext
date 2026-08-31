import type { ExpertDef, ProviderId, ProviderSettings, TermEntry } from '../core/config';

export interface TranslateCallOptions {
  signal?: AbortSignal;
  expert?: ExpertDef;
  /** Glossary entries; AI providers inject them into the system prompt */
  terms?: TermEntry[];
  /** Shared document context (summary/terminology) for consistent AI output */
  context?: string;
  /** Streaming callback (only honored by providers with supportsStream) */
  onDelta?: (delta: string) => void;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  models?: string[];
}

export interface Provider {
  id: ProviderId;
  name: string;
  /** true if this provider is an LLM (uses expert prompts, supports refine) */
  isAI: boolean;
  supportsStream: boolean;
  /** Batching limits used by the background scheduler */
  maxBatchItems: number;
  batchCharLimit: number;
  defaultConcurrency: number;
  translate(
    texts: string[],
    from: string,
    to: string,
    cfg: ProviderSettings,
    opts?: TranslateCallOptions,
  ): Promise<(string | null)[]>;
  test(cfg: ProviderSettings): Promise<ProviderTestResult>;
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 30000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const outerSignal = rest.signal;
  if (outerSignal) {
    if (outerSignal.aborted) ctrl.abort();
    else outerSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const res = await fetch(url, { ...rest, signal: ctrl.signal });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        /* ignore */
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${detail}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
