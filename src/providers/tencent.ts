import { fetchJson, type Provider } from './base';

const HOST = 'tmt.tencentcloudapi.com';
const SERVICE = 'tmt';
const ACTION = 'TextTranslateBatch';
const VERSION = '2018-03-21';

/** Languages supported by Tencent TMT, keyed by our app codes. */
const LANG_MAP: Record<string, string> = {
  auto: 'auto',
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  it: 'it',
  de: 'de',
  tr: 'tr',
  ru: 'ru',
  pt: 'pt',
  vi: 'vi',
  id: 'id',
  th: 'th',
  ms: 'ms',
  ar: 'ar',
  hi: 'hi',
};

function toTencentLang(code: string): string {
  const mapped = LANG_MAP[code] ?? LANG_MAP[code.split('-')[0] ?? ''];
  if (!mapped) throw new Error(`腾讯翻译不支持语言 ${code}`);
  return mapped;
}

const encoder = new TextEncoder();

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

/** TC3-HMAC-SHA256 request signing (Tencent Cloud API 3.0). */
async function signedHeaders(
  secretId: string,
  secretKey: string,
  region: string,
  payload: string,
): Promise<Record<string, string>> {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json; charset=utf-8\nhost:${HOST}\n`,
    'content-type;host',
    await sha256Hex(payload),
  ].join('\n');

  const credentialScope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = await hmac(encoder.encode(`TC3${secretKey}`), date);
  const kService = await hmac(kDate, SERVICE);
  const kSigning = await hmac(kService, 'tc3_request');
  const sigBytes = await hmac(kSigning, stringToSign);
  const signature = [...new Uint8Array(sigBytes)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return {
    'Content-Type': 'application/json; charset=utf-8',
    Authorization:
      `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
      `SignedHeaders=content-type;host, Signature=${signature}`,
    'X-TC-Action': ACTION,
    'X-TC-Version': VERSION,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': region,
  };
}

interface TmtResponse {
  Response: {
    TargetTextList?: string[];
    Error?: { Code: string; Message: string };
  };
}

export const tencentProvider: Provider = {
  id: 'tencent',
  name: '腾讯翻译',
  isAI: false,
  supportsStream: false,
  maxBatchItems: 30,
  batchCharLimit: 5000,
  defaultConcurrency: 2, // TMT default quota is 5 qps
  async translate(texts, from, to, cfg, opts) {
    if (!cfg.secretId || !cfg.secretKey) {
      throw new Error('401 unauthorized: 未配置腾讯云 SecretId / SecretKey');
    }
    const payload = JSON.stringify({
      SourceTextList: texts,
      Source: toTencentLang(from),
      Target: toTencentLang(to),
      ProjectId: 0,
    });
    const headers = await signedHeaders(
      cfg.secretId,
      cfg.secretKey,
      cfg.region || 'ap-guangzhou',
      payload,
    );
    const data = await fetchJson<TmtResponse>(`https://${HOST}`, {
      method: 'POST',
      headers,
      body: payload,
      signal: opts?.signal,
    });
    if (data.Response.Error) {
      const { Code, Message } = data.Response.Error;
      if (/AuthFailure/i.test(Code)) throw new Error(`401 unauthorized: ${Message}`);
      throw new Error(`${Code}: ${Message}`);
    }
    return texts.map((_, i) => data.Response.TargetTextList?.[i] ?? null);
  },
  async test(cfg) {
    if (!cfg.secretId || !cfg.secretKey) {
      return { ok: false, message: '请先填写腾讯云 SecretId 和 SecretKey' };
    }
    try {
      const out = await this.translate(['hello'], 'en', 'zh-CN', cfg);
      return { ok: true, message: `连接正常（hello → ${out[0] ?? '?'}）` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  },
};
