import type { ProviderSettings } from '../core/config';
import { translateViaChat, type ChatFn, type ChatMessage } from './ai-common';
import { fetchJson, type Provider } from './base';

function baseUrl(cfg: ProviderSettings): string {
  return (cfg.baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
}

function model(cfg: ProviderSettings): string {
  return cfg.model || 'gemini-2.5-flash';
}

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text?: string; inline_data?: { mime_type: string; data: string } }[];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

function toGeminiPayload(messages: ChatMessage[]): {
  systemInstruction?: { parts: { text: string }[] };
  contents: GeminiContent[];
} {
  const systemTexts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const contents: GeminiContent[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return {
    ...(systemTexts.length > 0
      ? { systemInstruction: { parts: [{ text: systemTexts.join('\n\n') }] } }
      : {}),
    contents,
  };
}

function candidateText(data: GeminiResponse): string {
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('');
}

function makeChat(cfg: ProviderSettings): ChatFn {
  return async (messages: ChatMessage[], opts) => {
    if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 Gemini API Key');
    const payload = { ...toGeminiPayload(messages), generationConfig: { temperature: 0.2 } };

    if (opts.onDelta) {
      const res = await fetch(
        `${baseUrl(cfg)}/models/${model(cfg)}:streamGenerateContent?alt=sse&key=${cfg.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: opts.signal,
        },
      );
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
            const json = JSON.parse(trimmed.slice(5).trim()) as GeminiResponse;
            const delta = candidateText(json);
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

    const data = await fetchJson<GeminiResponse>(
      `${baseUrl(cfg)}/models/${model(cfg)}:generateContent?key=${cfg.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: opts.signal,
        timeoutMs: 120000,
      },
    );
    if (data.error?.message) throw new Error(data.error.message);
    return candidateText(data);
  };
}

export async function geminiVision(
  cfg: ProviderSettings,
  prompt: string,
  imageDataUrl: string,
): Promise<string> {
  if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 Gemini API Key');
  const mime = imageDataUrl.slice(5, imageDataUrl.indexOf(';')) || 'image/png';
  const base64 = imageDataUrl.slice(imageDataUrl.indexOf(',') + 1);
  const data = await fetchJson<GeminiResponse>(
    `${baseUrl(cfg)}/models/${model(cfg)}:generateContent?key=${cfg.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }],
          },
        ],
        generationConfig: { temperature: 0.2 },
      }),
      timeoutMs: 120000,
    },
  );
  if (data.error?.message) throw new Error(data.error.message);
  return candidateText(data);
}

export const geminiProvider: Provider = {
  id: 'gemini',
  name: 'Google Gemini',
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
  vision: geminiVision,
  async test(cfg) {
    if (!cfg.apiKey) return { ok: false, message: '请先填写 API Key' };
    try {
      const data = await fetchJson<{ models?: { name: string }[] }>(
        `${baseUrl(cfg)}/models?pageSize=100&key=${cfg.apiKey}`,
        { timeoutMs: 10000 },
      );
      const models = (data.models ?? [])
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => n.includes('gemini'));
      return { ok: true, message: `连接正常，共 ${models.length} 个可用模型`, models };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
