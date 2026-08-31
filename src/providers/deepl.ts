import { fetchJson, type Provider } from './base';

const LANG_MAP: Record<string, string> = {
  'zh-CN': 'ZH-HANS',
  'zh-TW': 'ZH-HANT',
  en: 'EN-US',
  pt: 'PT-BR',
};

function toDeepLLang(code: string, isSource: boolean): string | undefined {
  if (code === 'auto') return undefined;
  const mapped = LANG_MAP[code] ?? code.toUpperCase();
  // DeepL source langs don't accept regional variants
  if (isSource) return mapped.split('-')[0];
  return mapped;
}

function endpoint(apiKey: string): string {
  return apiKey.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

interface DeepLResponse {
  translations: { text: string; detected_source_language: string }[];
}

export const deeplProvider: Provider = {
  id: 'deepl',
  name: 'DeepL',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 40,
  batchCharLimit: 6000,
  defaultConcurrency: 3,
  async translate(texts, from, to, cfg, opts) {
    if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 DeepL API Key');
    const body: Record<string, unknown> = {
      text: texts,
      target_lang: toDeepLLang(to, false),
    };
    const src = toDeepLLang(from, true);
    if (src) body.source_lang = src;
    const data = await fetchJson<DeepLResponse>(`${endpoint(cfg.apiKey)}/v2/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `DeepL-Auth-Key ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: opts?.signal,
    });
    return texts.map((_, i) => data.translations[i]?.text ?? null);
  },
  async test(cfg) {
    if (!cfg.apiKey) return { ok: false, message: '请先填写 API Key' };
    try {
      const usage = await fetchJson<{ character_count: number; character_limit: number }>(
        `${endpoint(cfg.apiKey)}/v2/usage`,
        { headers: { Authorization: `DeepL-Auth-Key ${cfg.apiKey}` } },
      );
      return {
        ok: true,
        message: `连接正常，本期已用 ${usage.character_count.toLocaleString()} / ${usage.character_limit.toLocaleString()} 字符`,
      };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
