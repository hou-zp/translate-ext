import { mapWithConcurrency } from '../core/queue';
import type { Provider } from './base';

/**
 * Free Google web endpoint (client=gtx). No API key required; used as the
 * out-of-the-box default provider.
 */
async function translateOne(
  text: string,
  from: string,
  to: string,
  signal?: AbortSignal,
): Promise<string> {
  const sl = from === 'auto' ? 'auto' : from;
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t' +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const data = (await res.json()) as unknown[];
  const segments = data[0] as [string, string][] | null;
  if (!Array.isArray(segments)) throw new Error('unexpected google response');
  return segments.map((s) => s?.[0] ?? '').join('');
}

export async function googleDetect(text: string): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=en&q=' +
    encodeURIComponent(text.slice(0, 200));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as unknown[];
  return typeof data[2] === 'string' ? (data[2] as string) : 'auto';
}

export const googleProvider: Provider = {
  id: 'google',
  name: '谷歌翻译',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 10,
  batchCharLimit: 4000,
  defaultConcurrency: 4,
  async translate(texts, from, to, _cfg, opts) {
    return mapWithConcurrency(texts, 6, async (text) => {
      try {
        return await translateOne(text, from, to, opts?.signal);
      } catch (err) {
        if (texts.length === 1) throw err;
        return null;
      }
    });
  },
  async test() {
    try {
      const out = await translateOne('hello', 'en', 'zh-CN');
      return { ok: out.length > 0, message: `连接正常（hello → ${out}）` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
