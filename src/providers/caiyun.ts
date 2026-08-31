import { fetchJson, type Provider } from './base';

const ENDPOINT = 'https://api.interpreter.caiyunai.com/v1/translator';

/** Caiyun trans_type language codes, keyed by our app codes. */
const LANG_MAP: Record<string, string> = {
  auto: 'auto',
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  fr: 'fr',
  ru: 'ru',
};

function toCaiyunLang(code: string): string {
  const mapped = LANG_MAP[code] ?? LANG_MAP[code.split('-')[0] ?? ''];
  if (!mapped) throw new Error(`彩云小译不支持语言 ${code}`);
  return mapped;
}

interface CaiyunResponse {
  target?: string[];
  message?: string;
}

export const caiyunProvider: Provider = {
  id: 'caiyun',
  name: '彩云小译',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 30,
  batchCharLimit: 5000,
  defaultConcurrency: 2,
  async translate(texts, from, to, cfg, opts) {
    if (!cfg.apiKey) throw new Error('401 unauthorized: 未配置彩云小译 Token');
    const data = await fetchJson<CaiyunResponse>(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': `token ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        source: texts,
        trans_type: `${toCaiyunLang(from)}2${toCaiyunLang(to)}`,
        request_id: 'translate-ext',
        detect: from === 'auto',
      }),
      signal: opts?.signal,
    });
    if (!data.target) throw new Error(data.message ?? '彩云小译未返回结果');
    return texts.map((_, i) => data.target?.[i] ?? null);
  },
  async test(cfg) {
    if (!cfg.apiKey) return { ok: false, message: '请先填写 Token' };
    try {
      const out = await this.translate(['hello'], 'en', 'zh-CN', cfg);
      return { ok: true, message: `连接正常（hello → ${out[0] ?? '?'}）` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
