/**
 * Client for a self-hosted pdf2zh / BabelDOC translation service
 * (https://github.com/Byaidu/PDFMathTranslate HTTP API):
 *   POST {base}/v1/translate            -> { id }
 *   GET  {base}/v1/translate/{id}       -> { state, info? }
 *   GET  {base}/v1/translate/{id}/dual  -> bilingual PDF bytes
 */

const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 30 * 60 * 1000;

function toServiceLang(code: string): string {
  if (code === 'auto') return 'auto';
  if (code.startsWith('zh')) return 'zh';
  return code.split('-')[0] ?? code;
}

export interface RemoteProgress {
  stage: 'upload' | 'translate' | 'download';
  done?: number;
  total?: number;
}

export async function translatePdfRemote(
  baseUrl: string,
  file: File,
  from: string,
  to: string,
  onProgress?: (p: RemoteProgress) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const base = baseUrl.replace(/\/$/, '');

  onProgress?.({ stage: 'upload' });
  const form = new FormData();
  form.append('file', file, file.name);
  form.append(
    'data',
    JSON.stringify({ lang_in: toServiceLang(from), lang_out: toServiceLang(to) }),
  );
  const createRes = await fetch(`${base}/v1/translate`, { method: 'POST', body: form, signal });
  if (!createRes.ok) {
    throw new Error(`服务返回 HTTP ${createRes.status}: ${(await createRes.text()).slice(0, 200)}`);
  }
  const { id } = (await createRes.json()) as { id?: string };
  if (!id) throw new Error('服务未返回任务 ID');

  const deadline = Date.now() + POLL_TIMEOUT;
  for (;;) {
    if (signal?.aborted) throw new Error('已取消');
    if (Date.now() > deadline) throw new Error('服务端翻译超时');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const pollRes = await fetch(`${base}/v1/translate/${id}`, { signal });
    if (!pollRes.ok) throw new Error(`查询任务失败 HTTP ${pollRes.status}`);
    const status = (await pollRes.json()) as {
      state?: string;
      info?: { n?: number; total?: number };
    };
    const state = (status.state ?? '').toUpperCase();
    if (state === 'SUCCESS') break;
    if (state === 'FAILURE' || state === 'ERROR') throw new Error('服务端翻译失败');
    onProgress?.({ stage: 'translate', done: status.info?.n, total: status.info?.total });
  }

  onProgress?.({ stage: 'download' });
  const fileRes = await fetch(`${base}/v1/translate/${id}/dual`, { signal });
  if (!fileRes.ok) throw new Error(`下载结果失败 HTTP ${fileRes.status}`);
  return fileRes.blob();
}
