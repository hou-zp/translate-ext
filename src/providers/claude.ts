import type { ProviderSettings } from '../core/config';
import { translateViaChat, type ChatFn, type ChatMessage } from './ai-common';
import { fetchJson, type Provider } from './base';

function baseUrl(cfg: ProviderSettings): string {
  return (cfg.baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
}

function model(cfg: ProviderSettings): string {
  return cfg.model || 'claude-sonnet-4-5';
}

function headers(cfg: ProviderSettings): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': cfg.apiKey ?? '',
    'anthropic-version': '2023-06-01',
    // Required for direct calls from extension contexts
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

type ClaudeContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface ClaudeResponse {
  content?: { type: string; text?: string }[];
  error?: { message?: string };
}

function splitMessages(messages: ChatMessage[]): {
  system: string;
  turns: { role: 'user' | 'assistant'; content: string }[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const turns = messages
    .filter((m): m is ChatMessage & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return { system, turns };
}

function makeChat(cfg: ProviderSettings): ChatFn {
  return async (messages: ChatMessage[], opts) => {
    if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 Claude API Key');
    const { system, turns } = splitMessages(messages);
    const body: Record<string, unknown> = {
      model: model(cfg),
      max_tokens: 8192,
      temperature: 0.2,
      messages: turns,
    };
    if (system) body.system = system;

    if (opts.onDelta) {
      const res = await fetch(`${baseUrl(cfg)}/messages`, {
        method: 'POST',
        headers: headers(cfg),
        body: JSON.stringify({ ...body, stream: true }),
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
          try {
            const json = JSON.parse(trimmed.slice(5).trim()) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            const delta = json.type === 'content_block_delta' ? json.delta?.text : undefined;
            if (delta) {
              full += delta;
              opts.onDelta(delta);
            }
          } catch {
            // partial SSE line
          }
        }
      }
      return full;
    }

    const data = await fetchJson<ClaudeResponse>(`${baseUrl(cfg)}/messages`, {
      method: 'POST',
      headers: headers(cfg),
      body: JSON.stringify(body),
      signal: opts.signal,
      timeoutMs: 120000,
    });
    if (data.error?.message) throw new Error(data.error.message);
    return (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  };
}

export async function claudeVision(
  cfg: ProviderSettings,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 Claude API Key');
  const mime = imageDataUrl.slice(5, imageDataUrl.indexOf(';')) || 'image/png';
  const base64 = imageDataUrl.slice(imageDataUrl.indexOf(',') + 1);
  const content: ClaudeContent[] = [
    { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
    { type: 'text', text: prompt },
  ];
  const data = await fetchJson<ClaudeResponse>(`${baseUrl(cfg)}/messages`, {
    method: 'POST',
    headers: headers(cfg),
    body: JSON.stringify({
      model: model(cfg),
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: 'user', content }],
    }),
    timeoutMs: 120000,
  });
  if (data.error?.message) throw new Error(data.error.message);
  return (data.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('');
}

export const claudeProvider: Provider = {
  id: 'claude',
  name: 'Anthropic Claude',
  isAI: true,
  supportsStream: true,
  maxBatchItems: 12,
  batchCharLimit: 3000,
  defaultConcurrency: 3,
  async translate(texts, from, to, cfg, opts) {
    return translateViaChat(makeChat(cfg), texts, from, to, opts);
  },
  chat(cfg) {
    return makeChat(cfg);
  },
  vision: claudeVision,
  async test(cfg) {
    if (!cfg.apiKey) return { ok: false, message: '请先填写 API Key' };
    try {
      const data = await fetchJson<{ data?: { id: string }[] }>(`${baseUrl(cfg)}/models?limit=50`, {
        headers: headers(cfg),
        timeoutMs: 10000,
      });
      const models = (data.data ?? []).map((m) => m.id);
      return { ok: true, message: `连接正常，共 ${models.length} 个可用模型`, models };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
