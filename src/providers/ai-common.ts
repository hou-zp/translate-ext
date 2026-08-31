import type { ExpertDef } from '../core/config';
import {
  BUILTIN_EXPERTS,
  buildBatchUserPrompt,
  buildSystemPrompt,
  parseBatchResponse,
} from '../core/prompts';
import { glossaryPrompt, matchTerms } from '../core/terms';
import type { TranslateCallOptions } from './base';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** A provider-specific chat completion call. Returns the full assistant text. */
export type ChatFn = (
  messages: ChatMessage[],
  opts: { signal?: AbortSignal; onDelta?: (delta: string) => void },
) => Promise<string>;

/**
 * Shared LLM translation flow: batch texts into one JSON prompt, parse the
 * reply tolerantly, and retry any failed items one-by-one so a single malformed
 * model output cannot sink the whole batch.
 */
export async function translateViaChat(
  chat: ChatFn,
  texts: string[],
  from: string,
  to: string,
  opts: TranslateCallOptions = {},
): Promise<(string | null)[]> {
  const expert: ExpertDef = opts.expert ?? BUILTIN_EXPERTS[0]!;
  const relevantTerms = matchTerms(texts.join('\n'), opts.terms ?? []);
  const contextBlock = opts.context
    ? `\n\nDocument context (use it to resolve pronouns and keep terminology consistent; do NOT translate or mention it):\n${opts.context}`
    : '';
  const system = buildSystemPrompt(expert, from, to) + contextBlock + glossaryPrompt(relevantTerms);

  // Single text with streaming requested: translate directly (no JSON wrapper),
  // so deltas can be shown as they arrive.
  if (texts.length === 1 && opts.onDelta) {
    const full = await chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: texts[0]! },
      ],
      { signal: opts.signal, onDelta: opts.onDelta },
    );
    return [full.trim() || null];
  }

  const raw = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: buildBatchUserPrompt(texts) },
    ],
    { signal: opts.signal },
  );
  const parsed = parseBatchResponse(raw, texts.length);

  // Per-item fallback for anything the model dropped or mangled.
  for (let i = 0; i < texts.length; i++) {
    if (parsed[i] !== null) continue;
    if (opts.signal?.aborted) break;
    try {
      const single = await chat(
        [
          { role: 'system', content: system },
          { role: 'user', content: texts[i]! },
        ],
        { signal: opts.signal },
      );
      parsed[i] = single.trim() || null;
    } catch {
      parsed[i] = null;
    }
  }
  return parsed;
}
