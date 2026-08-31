import { fetchJson, type Provider } from './base';

const ENDPOINT = 'https://api.cognitive.microsofttranslator.com';

const LANG_MAP: Record<string, string> = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
};

function toMsLang(code: string): string {
  return LANG_MAP[code] ?? code;
}

interface MsTranslation {
  translations: { text: string; to: string }[];
}

export const microsoftProvider: Provider = {
  id: 'microsoft',
  name: '微软翻译',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 50,
  batchCharLimit: 9000,
  defaultConcurrency: 3,
  async translate(texts, from, to, cfg, opts) {
    if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置 Azure 翻译 Key');
    const params = new URLSearchParams({ 'api-version': '3.0', to: toMsLang(to) });
    if (from !== 'auto') params.set('from', toMsLang(from));
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Ocp-Apim-Subscription-Key': cfg.apiKey,
    };
    if (cfg.region) headers['Ocp-Apim-Subscription-Region'] = cfg.region;
    const data = await fetchJson<MsTranslation[]>(
      `${cfg.baseUrl?.replace(/\/$/, '') || ENDPOINT}/translate?${params.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(texts.map((t) => ({ Text: t }))),
        signal: opts?.signal,
      },
    );
    return texts.map((_, i) => data[i]?.translations?.[0]?.text ?? null);
  },
  async test(cfg) {
    if (!cfg.apiKey) return { ok: false, message: '请先填写 API Key（如非全球资源还需填写区域）' };
    try {
      const out = await this.translate(['hello'], 'en', 'zh-CN', cfg);
      return { ok: true, message: `连接正常（hello → ${out[0] ?? '?'}）` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
