import { fetchJson, type Provider } from './base';

const ENDPOINT = 'https://fanyi-api.baidu.com/api/trans/vip/translate';

/** Baidu fanyi language codes, keyed by our app codes. */
const LANG_MAP: Record<string, string> = {
  auto: 'auto',
  'zh-CN': 'zh',
  'zh-TW': 'cht',
  en: 'en',
  ja: 'jp',
  ko: 'kor',
  fr: 'fra',
  es: 'spa',
  th: 'th',
  ar: 'ara',
  ru: 'ru',
  pt: 'pt',
  de: 'de',
  it: 'it',
  el: 'el',
  nl: 'nl',
  pl: 'pl',
  da: 'dan',
  fi: 'fin',
  cs: 'cs',
  ro: 'rom',
  sv: 'swe',
  hu: 'hu',
  vi: 'vie',
};

function toBaiduLang(code: string): string {
  const mapped = LANG_MAP[code] ?? LANG_MAP[code.split('-')[0] ?? ''];
  if (!mapped) throw new Error(`百度翻译不支持语言 ${code}`);
  return mapped;
}

// ---- MD5 (Baidu's sign algorithm requires it; WebCrypto has no MD5) ----

function md5(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15,
    21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32);

  const paddedLen = (((bytes.length + 8) >> 6) + 1) << 6;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const bitLen = bytes.length * 8;
  new DataView(padded.buffer).setUint32(paddedLen - 8, bitLen >>> 0, true);
  new DataView(padded.buffer).setUint32(paddedLen - 4, Math.floor(bitLen / 2 ** 32), true);

  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const view = new DataView(padded.buffer);
  const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

  for (let chunk = 0; chunk < paddedLen; chunk += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = view.getUint32(chunk + i * 4, true);
    let [A, B, C, D] = [a0, b0, c0, d0];
    for (let i = 0; i < 64; i++) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      const tmp = D;
      D = C;
      C = B;
      B = (B + rotl((A + F + (K[i] ?? 0) + (M[g] ?? 0)) >>> 0, s[i] ?? 0)) >>> 0;
      A = tmp;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return [...out].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface BaiduResponse {
  trans_result?: { src: string; dst: string }[];
  error_code?: string;
  error_msg?: string;
}

export const baiduProvider: Provider = {
  id: 'baidu',
  name: '百度翻译',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 20,
  batchCharLimit: 5000,
  defaultConcurrency: 1, // free tier allows 1 qps
  async translate(texts, from, to, cfg, opts) {
    if (!cfg.appId || !cfg.apiKey) {
      throw new Error('401 unauthorized: 未配置百度翻译 APP ID / 密钥');
    }
    // Baidu treats \n as the batch separator, so flatten newlines inside items.
    const flattened = texts.map((t) => t.replace(/\n+/g, ' '));
    const q = flattened.join('\n');
    const salt = String(Date.now());
    const sign = md5(cfg.appId + q + salt + cfg.apiKey);
    const body = new URLSearchParams({
      q,
      from: toBaiduLang(from),
      to: toBaiduLang(to),
      appid: cfg.appId,
      salt,
      sign,
    });
    const data = await fetchJson<BaiduResponse>(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: opts?.signal,
    });
    if (data.error_code && data.error_code !== '52000') {
      const msg = `${data.error_code}: ${data.error_msg ?? '百度翻译请求失败'}`;
      if (data.error_code === '52003' || data.error_code === '54001') {
        throw new Error(`401 unauthorized: ${msg}`);
      }
      if (data.error_code === '54003' || data.error_code === '54004') {
        throw new Error(`429 quota: ${msg}`);
      }
      throw new Error(msg);
    }
    return texts.map((_, i) => data.trans_result?.[i]?.dst ?? null);
  },
  async test(cfg) {
    if (!cfg.appId || !cfg.apiKey) {
      return { ok: false, message: '请先填写 APP ID 和密钥' };
    }
    try {
      const out = await this.translate(['hello'], 'en', 'zh-CN', cfg);
      return { ok: true, message: `连接正常（hello → ${out[0] ?? '?'}）` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
