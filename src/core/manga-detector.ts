import { browser } from 'wxt/browser';
import * as ort from 'onnxruntime-web/wasm';

/**
 * Local ONNX text-region detector for manga mode. Runs inside the offscreen
 * document (Chromium). The ONNX runtime wasm and the model file are
 * downloaded on first use and cached in OPFS, so the extension package stays
 * small and everything after the first run works offline.
 *
 * Supported model output layouts (single-class "text region" detectors):
 *  - YOLOv8-style: [1, 4+nc, N] (channels-first)
 *  - YOLOv5-style: [1, N, 5+nc] (per-box rows with objectness)
 */

const ORT_VERSION = '1.29.0';
const ORT_CDN = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const INPUT_SIZE = 1024;
const CONF_THRESHOLD = 0.3;
const IOU_THRESHOLD = 0.45;

export interface DetectedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

/** Fetch a URL once and keep the bytes in OPFS for subsequent runs. */
async function cachedFetch(name: string, url: string): Promise<Blob> {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle('txe-models', { create: true });
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    if (file.size > 0) return file;
  } catch {
    // cache miss
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
  const blob = await res.blob();
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return blob;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let sessionModelUrl = '';

async function getSession(modelUrl: string): Promise<ort.InferenceSession> {
  if (sessionPromise && sessionModelUrl === modelUrl) return sessionPromise;
  sessionModelUrl = modelUrl;
  sessionPromise = (async () => {
    // The 13MB wasm binary is downloaded once and cached in OPFS; the small
    // emscripten glue (.mjs) ships with the extension bundle. Injecting the
    // binary via wasmBinary keeps the package lean and satisfies MV3 CSP.
    const wasm = await cachedFetch(
      `ort-${ORT_VERSION}.wasm`,
      `${ORT_CDN}ort-wasm-simd-threaded.wasm`,
    );
    ort.env.wasm.wasmBinary = await wasm.arrayBuffer();
    // The glue module must come from the extension package (MV3 CSP forbids
    // blob: script imports); the binary itself is injected via wasmBinary.
    const mjsUrl = browser.runtime.getURL('/ort/ort-wasm-simd-threaded.mjs');
    // the wasm entry is never fetched (wasmBinary above takes precedence)
    ort.env.wasm.wasmPaths = { mjs: mjsUrl, wasm: mjsUrl.replace(/\.mjs$/, '.wasm') };
    ort.env.wasm.numThreads = 1;
    const model = await cachedFetch(`model-${djb2(modelUrl)}.onnx`, modelUrl);
    return ort.InferenceSession.create(new Uint8Array(await model.arrayBuffer()), {
      executionProviders: ['wasm'],
    });
  })();
  try {
    return await sessionPromise;
  } catch (err) {
    sessionPromise = null; // allow retry after transient download failures
    throw err;
  }
}

interface Letterbox {
  ratio: number;
  padX: number;
  padY: number;
  origW: number;
  origH: number;
}

async function preprocess(dataUrl: string): Promise<{ tensor: ort.Tensor; box: Letterbox }> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const { width: origW, height: origH } = bitmap;
  const ratio = Math.min(INPUT_SIZE / origW, INPUT_SIZE / origH);
  const newW = Math.round(origW * ratio);
  const newH = Math.round(origH * ratio);
  const padX = Math.floor((INPUT_SIZE - newW) / 2);
  const padY = Math.floor((INPUT_SIZE - newH) / 2);

  const canvas = new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建画布');
  ctx.fillStyle = '#727272';
  ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  ctx.drawImage(bitmap, padX, padY, newW, newH);
  bitmap.close();

  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    chw[i] = (data[i * 4] ?? 0) / 255;
    chw[plane + i] = (data[i * 4 + 1] ?? 0) / 255;
    chw[2 * plane + i] = (data[i * 4 + 2] ?? 0) / 255;
  }
  return {
    tensor: new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE]),
    box: { ratio, padX, padY, origW, origH },
  };
}

interface RawBox extends DetectedBox {
  conf: number;
}

/** Decode either YOLOv8 ([1,C,N]) or YOLOv5 ([1,N,C]) style outputs. */
function decodeOutput(output: ort.Tensor, box: Letterbox): RawBox[] {
  const dims = output.dims;
  const data = output.data as Float32Array;
  if (dims.length !== 3) return [];
  const channelsFirst = (dims[1] ?? 0) < (dims[2] ?? 0);
  const numBoxes = channelsFirst ? (dims[2] ?? 0) : (dims[1] ?? 0);
  const numChannels = channelsFirst ? (dims[1] ?? 0) : (dims[2] ?? 0);
  if (numChannels < 5) return [];
  const at = (b: number, c: number) =>
    channelsFirst ? (data[c * numBoxes + b] ?? 0) : (data[b * numChannels + c] ?? 0);
  const hasObjectness = !channelsFirst; // v5 rows carry objectness at index 4

  const out: RawBox[] = [];
  for (let b = 0; b < numBoxes; b++) {
    let conf: number;
    if (hasObjectness) {
      let best = 0;
      for (let c = 5; c < numChannels; c++) best = Math.max(best, at(b, c));
      conf = numChannels > 5 ? at(b, 4) * best : at(b, 4);
    } else {
      conf = 0;
      for (let c = 4; c < numChannels; c++) conf = Math.max(conf, at(b, c));
    }
    if (conf < CONF_THRESHOLD) continue;
    const cx = at(b, 0);
    const cy = at(b, 1);
    const w = at(b, 2);
    const h = at(b, 3);
    // map from letterboxed input space back to the original image, normalized
    const x0 = (cx - w / 2 - box.padX) / box.ratio / box.origW;
    const y0 = (cy - h / 2 - box.padY) / box.ratio / box.origH;
    const nw = w / box.ratio / box.origW;
    const nh = h / box.ratio / box.origH;
    const cl = (v: number) => Math.min(1, Math.max(0, v));
    const x = cl(x0);
    const y = cl(y0);
    out.push({ x, y, w: cl(x0 + nw) - x, h: cl(y0 + nh) - y, conf });
  }
  return out;
}

function iou(a: DetectedBox, b: DetectedBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function nms(boxes: RawBox[]): DetectedBox[] {
  const sorted = [...boxes].sort((a, b) => b.conf - a.conf);
  const kept: RawBox[] = [];
  for (const box of sorted) {
    if (kept.every((k) => iou(k, box) < IOU_THRESHOLD)) kept.push(box);
    if (kept.length >= 40) break;
  }
  return kept.map(({ x, y, w, h }) => ({ x, y, w, h }));
}

/** Detect text regions in an image (data URL). Returns normalized boxes. */
export async function detectTextRegions(
  dataUrl: string,
  modelUrl: string,
): Promise<{ boxes: DetectedBox[] }> {
  const session = await getSession(modelUrl);
  const { tensor, box } = await preprocess(dataUrl);
  const inputName = session.inputNames[0];
  if (!inputName) throw new Error('模型没有输入节点');
  const results = await session.run({ [inputName]: tensor });
  const outputName = session.outputNames[0];
  const output = outputName ? results[outputName] : undefined;
  if (!output) return { boxes: [] };
  return { boxes: nms(decodeOutput(output as ort.Tensor, box)) };
}
