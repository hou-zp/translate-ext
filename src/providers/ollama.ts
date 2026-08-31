import type { ProviderSettings } from '../core/config';
import { translateViaChat, type ChatFn, type ChatMessage } from './ai-common';
import { fetchJson, type Provider } from './base';

function baseUrl(cfg: ProviderSettings): string {
  return (cfg.baseUrl || 'http://127.0.0.1:11434').replace(/\/$/, '');
}

function model(cfg: ProviderSettings): string {
  return cfg.model || 'qwen2.5:7b';
}

function offlineError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Failed to fetch|NetworkError|ECONNREFUSED|abort/i.test(msg)) {
    return new Error(
      'ollama-offline: 无法连接本地 Ollama，请确认已运行 `ollama serve`，' +
        '并设置环境变量 OLLAMA_ORIGINS="*" 以允许扩展访问',
    );
  }
  return err instanceof Error ? err : new Error(msg);
}

function makeChat(cfg: ProviderSettings): ChatFn {
  return async (messages: ChatMessage[], opts) => {
    try {
      if (opts.onDelta) {
        const res = await fetch(`${baseUrl(cfg)}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model(cfg), messages, stream: true }),
          signal: opts.signal,
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${res.statusText}`);
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
            if (!line.trim()) continue;
            try {
              const json = JSON.parse(line) as { message?: { content?: string } };
              const delta = json.message?.content;
              if (delta) {
                full += delta;
                opts.onDelta(delta);
              }
            } catch {
              // partial NDJSON line
            }
          }
        }
        return full;
      }

      const data = await fetchJson<{ message?: { content?: string } }>(
        `${baseUrl(cfg)}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model(cfg), messages, stream: false }),
          signal: opts.signal,
          timeoutMs: 300000, // local models can be slow
        },
      );
      return data.message?.content ?? '';
    } catch (err) {
      throw offlineError(err);
    }
  };
}

export function ollamaChat(cfg: ProviderSettings): ChatFn {
  return makeChat(cfg);
}

/** Multimodal call: send an image (raw base64, no data: prefix) with a prompt. */
export async function ollamaVision(
  cfg: ProviderSettings,
  prompt: string,
  imageBase64: string,
): Promise<string> {
  try {
    const data = await fetchJson<{ message?: { content?: string } }>(`${baseUrl(cfg)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model(cfg),
        stream: false,
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
      }),
      timeoutMs: 300000,
    });
    return data.message?.content ?? '';
  } catch (err) {
    throw offlineError(err);
  }
}

export async function listOllamaModels(cfg: ProviderSettings): Promise<string[]> {
  const data = await fetchJson<{ models?: { name: string }[] }>(`${baseUrl(cfg)}/api/tags`, {
    timeoutMs: 5000,
  });
  return (data.models ?? []).map((m) => m.name);
}

export const ollamaProvider: Provider = {
  id: 'ollama',
  name: 'Ollama（本地）',
  isAI: true,
  supportsStream: true,
  maxBatchItems: 8,
  batchCharLimit: 2000,
  defaultConcurrency: 1, // local inference: keep it serial by default
  async translate(texts, from, to, cfg, opts) {
    return translateViaChat(makeChat(cfg), texts, from, to, opts);
  },
  async test(cfg) {
    try {
      const models = await listOllamaModels(cfg);
      if (models.length === 0) {
        return { ok: false, message: 'Ollama 已连接，但没有任何本地模型，请先 `ollama pull` 一个模型' };
      }
      const current = model(cfg);
      const hasCurrent = models.includes(current);
      return {
        ok: true,
        message: hasCurrent
          ? `连接正常，当前模型 ${current} 可用`
          : `连接正常，但当前模型 ${current} 不在本地列表中`,
        models,
      };
    } catch (err) {
      return { ok: false, message: offlineError(err).message };
    }
  },
};
