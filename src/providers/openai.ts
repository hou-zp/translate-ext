import type { ProviderSettings } from '../core/config';
import { translateViaChat, type ChatFn, type ChatMessage } from './ai-common';
import { fetchJson, type Provider } from './base';

function baseUrl(cfg: ProviderSettings): string {
  return (cfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
}

function model(cfg: ProviderSettings): string {
  return cfg.model || 'gpt-4o-mini';
}

interface ChatCompletion {
  choices: { message: { content: string } }[];
}

function makeChat(cfg: ProviderSettings): ChatFn {
  return async (messages: ChatMessage[], opts) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;

    if (opts.onDelta) {
      const res = await fetch(`${baseUrl(cfg)}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: model(cfg), messages, temperature: 0.2, stream: true }),
        signal: opts.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 300)}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              opts.onDelta(delta);
            }
          } catch {
            // partial SSE line, ignore
          }
        }
      }
      return full;
    }

    const data = await fetchJson<ChatCompletion>(`${baseUrl(cfg)}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: model(cfg), messages, temperature: 0.2 }),
      signal: opts.signal,
      timeoutMs: 120000,
    });
    return data.choices?.[0]?.message?.content ?? '';
  };
}

/** Direct chat access for the refine pipeline. */
export function openaiChat(cfg: ProviderSettings): ChatFn {
  return makeChat(cfg);
}

/** Multimodal call: send an image (data URL) with a text prompt. */
export async function openaiVision(
  cfg: ProviderSettings,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  const data = await fetchJson<ChatCompletion>(`${baseUrl(cfg)}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model(cfg),
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
    timeoutMs: 120000,
  });
  return data.choices?.[0]?.message?.content ?? '';
}

export const openaiProvider: Provider = {
  id: 'openai',
  name: 'OpenAI 兼容',
  isAI: true,
  supportsStream: true,
  maxBatchItems: 12,
  batchCharLimit: 3000,
  defaultConcurrency: 4,
  async translate(texts, from, to, cfg, opts) {
    return translateViaChat(makeChat(cfg), texts, from, to, opts);
  },
  chat(cfg) {
    return makeChat(cfg);
  },
  vision: openaiVision,
  async test(cfg) {
    if (!cfg.apiKey && baseUrl(cfg).includes('api.openai.com')) {
      return { ok: false, message: '请先填写 API Key' };
    }
    try {
      const headers: Record<string, string> = {};
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      const data = await fetchJson<{ data?: { id: string }[] }>(`${baseUrl(cfg)}/models`, {
        headers,
        timeoutMs: 10000,
      });
      const models = (data.data ?? []).map((m) => m.id).slice(0, 50);
      return { ok: true, message: `连接正常，共 ${models.length} 个可用模型`, models };
    } catch {
      // some gateways don't implement /models; fall back to a tiny chat
      try {
        const out = await makeChat(cfg)(
          [{ role: 'user', content: 'Reply with the single word: ok' }],
          {},
        );
        return { ok: out.length > 0, message: '连接正常' };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    }
  },
};
