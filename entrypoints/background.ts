import { defineBackground } from '#imports';
import { browser } from 'wxt/browser';
import { TranslationCache, cacheKey } from '../src/core/cache';
import { loadConfig, saveConfig, type AppConfig, type ProviderId } from '../src/core/config';
import {
  onBackgroundMessage,
  STREAM_PORT_NAME,
  type BatchItemError,
  type StreamEvent,
  type StreamTranslateReq,
  type TranslateBatchReq,
  type TranslateBatchRes,
} from '../src/core/messaging';
import { detectLangHeuristic } from '../src/core/langs';
import { buildRefinePrompts, getExpert } from '../src/core/prompts';
import { chunkTexts, mapWithConcurrency, withRetry, type IndexedText } from '../src/core/queue';
import { parseMangaRegions, renderMangaImage } from '../src/core/manga-canvas';
import { sendToOffscreen, type MangaRegion } from '../src/core/messaging';
import { refreshSubscribedRules } from '../src/core/rules-sync';
import { startConfigSync } from '../src/core/sync';
import { glossaryPrompt, lockTerms, matchTerms, restoreTerms, termsSignature } from '../src/core/terms';
import { getProvider } from '../src/providers';
import { googleDetect } from '../src/providers/google';
import { listOllamaModels } from '../src/providers/ollama';
import type { ChatFn } from '../src/providers/ai-common';
import { langEnglishName } from '../src/core/langs';

const cache = new TranslationCache();

function classifyError(err: unknown): BatchItemError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.startsWith('ollama-offline')) {
    return { code: 'ollama-offline', message: msg.replace(/^ollama-offline:\s*/, '') };
  }
  if (/\b(401|403|unauthorized|invalid[_ ]api[_ ]key|未配置)\b/i.test(msg)) {
    return { code: 'auth', message: 'API Key 无效或未配置，请到设置页检查翻译服务配置' };
  }
  if (/\b(429|quota|rate limit|insufficient)\b/i.test(msg)) {
    return { code: 'quota', message: '请求过于频繁或配额已用尽，请稍后再试' };
  }
  if (/Failed to fetch|NetworkError|network|timeout|abort/i.test(msg)) {
    return { code: 'network', message: '网络请求失败，请检查网络连接' };
  }
  return { code: 'other', message: msg.slice(0, 200) };
}

async function translateBatch(req: TranslateBatchReq): Promise<TranslateBatchRes> {
  const cfg = await loadConfig();
  await cache.ensureLoaded();
  const providerId: ProviderId = req.provider ?? cfg.provider;
  const provider = getProvider(providerId);
  const pcfg = cfg.providers[providerId] ?? {};
  const expert = getExpert(cfg, req.expertId ?? cfg.expertId);

  const results: (string | null)[] = new Array(req.texts.length).fill(null);
  const errors: (BatchItemError | null)[] = new Array(req.texts.length).fill(null);
  const termsSig = termsSignature(cfg.terms);

  const keyFor = (text: string) =>
    cacheKey({
      provider: providerId,
      model: pcfg.model,
      from: req.from,
      to: `${req.to}${termsSig ? `#${termsSig}` : ''}`,
      expertId: provider.isAI ? expert.id : undefined,
      text,
    });

  const pending: IndexedText[] = [];
  req.texts.forEach((text, idx) => {
    if (cfg.cacheEnabled && !req.noCache) {
      const hit = cache.get(keyFor(text));
      if (hit !== undefined) {
        results[idx] = hit;
        return;
      }
    }
    pending.push({ idx, text });
  });

  if (pending.length > 0) {
    const batches = chunkTexts(pending, provider.maxBatchItems, provider.batchCharLimit);
    const concurrency = pcfg.concurrency ?? provider.defaultConcurrency;
    await mapWithConcurrency(batches, concurrency, async (batch) => {
      // Non-AI engines can't follow a glossary prompt: lock matched terms
      // behind pass-through placeholders and substitute the fixed target after.
      const useLocking = !provider.isAI && cfg.terms.length > 0;
      const lockedBatch = batch.items.map((item) =>
        useLocking ? lockTerms(item.text, cfg.terms) : { locked: item.text, used: [] },
      );
      const texts = lockedBatch.map((l) => l.locked);
      try {
        const out = await withRetry(() =>
          provider.translate(texts, req.from, req.to, pcfg, {
            expert,
            terms: cfg.terms,
            context: req.context,
          }),
        );
        batch.items.forEach((item, j) => {
          let value = out[j];
          if (typeof value === 'string' && value.length > 0) {
            const used = lockedBatch[j]?.used ?? [];
            if (used.length > 0) value = restoreTerms(value, used);
            results[item.idx] = value;
            if (cfg.cacheEnabled) cache.set(keyFor(item.text), value);
          } else {
            errors[item.idx] = { code: 'parse', message: '模型未返回该段译文' };
          }
        });
      } catch (err) {
        const e = classifyError(err);
        batch.items.forEach((item) => {
          errors[item.idx] = e;
        });
      }
    });
  }

  return { results, errors };
}

function refineChat(cfg: AppConfig): { chat: ChatFn; providerId: ProviderId; model?: string } {
  // Prefer the active provider when it is already an LLM.
  const active = getProvider(cfg.provider);
  let providerId: ProviderId = active.isAI ? cfg.provider : cfg.refineProvider;
  let provider = getProvider(providerId);
  if (!provider.chat) {
    providerId = 'ollama';
    provider = getProvider(providerId);
  }
  const pcfg = cfg.providers[providerId] ?? {};
  const chat = provider.chat;
  if (!chat) throw new Error('没有可用的 AI 服务，请在设置中配置');
  return { chat: chat.call(provider, pcfg), providerId, model: pcfg.model };
}

async function refineBatch(req: {
  originals: string[];
  drafts: string[];
  from: string;
  to: string;
  expertId?: string;
  context?: string;
}): Promise<TranslateBatchRes> {
  const cfg = await loadConfig();
  await cache.ensureLoaded();
  const expert = getExpert(cfg, req.expertId ?? cfg.expertId);
  const { chat, providerId, model } = refineChat(cfg);

  const results: (string | null)[] = new Array(req.originals.length).fill(null);
  const errors: (BatchItemError | null)[] = new Array(req.originals.length).fill(null);

  const keyFor = (text: string) =>
    cacheKey({
      provider: providerId,
      model,
      from: req.from,
      to: req.to,
      expertId: expert.id,
      refined: true,
      text,
    });

  await mapWithConcurrency(
    req.originals.map((_, i) => i),
    providerId === 'ollama' ? 1 : 3,
    async (i) => {
      const original = req.originals[i] ?? '';
      const draft = req.drafts[i] ?? '';
      if (cfg.cacheEnabled) {
        const hit = cache.get(keyFor(original));
        if (hit !== undefined) {
          results[i] = hit;
          return;
        }
      }
      try {
        const { system: baseSystem, user } = buildRefinePrompts(
          expert,
          req.from,
          req.to,
          original,
          draft,
        );
        const contextBlock = req.context
          ? `\n\nDocument context (for terminology/pronoun consistency, do not mention it):\n${req.context}`
          : '';
        const system =
          baseSystem + contextBlock + glossaryPrompt(matchTerms(original, cfg.terms));
        const out = await withRetry(
          () =>
            chat(
              [
                { role: 'system', content: system },
                { role: 'user', content: user },
              ],
              {},
            ),
          1,
        );
        const clean = out.trim();
        if (clean) {
          results[i] = clean;
          if (cfg.cacheEnabled) cache.set(keyFor(original), clean);
        } else {
          errors[i] = { code: 'parse', message: '精翻模型未返回内容' };
        }
      } catch (err) {
        errors[i] = classifyError(err);
      }
    },
  );

  return { results, errors };
}

/** One-shot summary of a page/document used as shared translation context. */
async function buildPageContext(req: {
  title: string;
  sample: string;
  to: string;
}): Promise<{ context: string }> {
  const cfg = await loadConfig();
  const { chat } = refineChat(cfg);
  const toName = langEnglishName(req.to);
  const prompt =
    `You are preparing shared context for a translation job (target language: ${toName}).\n` +
    `Given the document title and excerpt below, reply with:\n` +
    `1. A 2-3 sentence summary of what the document is about.\n` +
    `2. Up to 8 key terms / named entities with the ${toName} translation to use consistently.\n` +
    `Keep the whole reply under 150 words. Reply in ${toName}.\n\n` +
    `Title: ${req.title}\n\nExcerpt:\n${req.sample.slice(0, 3000)}`;
  const out = await withRetry(() => chat([{ role: 'user', content: prompt }], {}), 1);
  return { context: out.trim().slice(0, 1500) };
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** OCR + translate an image with a multimodal model (OpenAI-compatible or Ollama). */
/** Pick the provider used for multimodal (vision) calls. */
function visionProvider(cfg: AppConfig): { providerId: ProviderId; vision: NonNullable<ReturnType<typeof getProvider>['vision']> } {
  const active = getProvider(cfg.provider);
  let providerId: ProviderId = active.isAI ? cfg.provider : cfg.refineProvider;
  let provider = getProvider(providerId);
  if (!provider.vision) {
    providerId = cfg.refineProvider;
    provider = getProvider(providerId);
  }
  const vision = provider.vision;
  if (!vision) throw new Error('当前服务不支持图片翻译，请在设置中配置支持视觉的 AI 服务');
  return { providerId, vision: vision.bind(provider) };
}

/** Fetch an image and normalize it to a data: URL (max 8MB). */
async function fetchImageAsDataUrl(srcUrl: string): Promise<string> {
  if (srcUrl.startsWith('data:')) return srcUrl;
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`图片下载失败 HTTP ${res.status}`);
  const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error('图片超过 8MB，暂不支持');
  return `data:${mime};base64,${bytesToBase64(buf)}`;
}

/** OCR + translate an image with a multimodal model. */
async function translateImage(req: { srcUrl: string; to: string }): Promise<{ text: string }> {
  const cfg = await loadConfig();
  const { providerId, vision } = visionProvider(cfg);
  const pcfg = cfg.providers[providerId] ?? {};
  const toName = langEnglishName(req.to);
  const dataUrl = await fetchImageAsDataUrl(req.srcUrl);

  const prompt =
    `Extract all readable text from this image, then translate it into ${toName}.\n` +
    `Reply with the translation only, keeping the original line structure. ` +
    `If the image contains no text, reply exactly: [no text]`;

  const out = await vision(pcfg, prompt, dataUrl);
  const text = out.trim();
  if (!text) throw new Error('模型未返回内容');
  return { text };
}

/**
 * Optional local detector: run the ONNX text detector in the offscreen
 * document (Chromium only). Returns null when unavailable so the vision
 * model detects regions on its own.
 */
async function detectMangaBoxes(
  dataUrl: string,
  modelUrl: string,
): Promise<{ x: number; y: number; w: number; h: number }[] | null> {
  const offscreen = (
    globalThis as unknown as {
      chrome?: {
        offscreen?: {
          hasDocument?: () => Promise<boolean>;
          createDocument: (opts: unknown) => Promise<void>;
        };
      };
    }
  ).chrome?.offscreen;
  if (!offscreen) return null;
  try {
    const has = await offscreen.hasDocument?.();
    if (!has) {
      await offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['WORKERS'],
        justification: '在本地运行 ONNX 文本检测，用于漫画翻译',
      });
    }
  } catch {
    // a concurrent call may have created it already
  }
  try {
    const res = await sendToOffscreen('detectTextRegions', { dataUrl, modelUrl });
    return res.boxes;
  } catch {
    return null;
  }
}

/**
 * Manga pipeline: ask the vision model for text regions as structured JSON,
 * erase + repaint each region on a canvas, and return the repainted image.
 * Falls back to the plain whole-image translation when the model cannot
 * produce usable regions.
 */
async function translateMangaImage(req: {
  srcUrl: string;
  to: string;
}): Promise<{ regions: MangaRegion[]; dataUrl?: string; fallbackText?: string }> {
  const cfg = await loadConfig();
  const { providerId, vision } = visionProvider(cfg);
  const pcfg = cfg.providers[providerId] ?? {};
  const toName = langEnglishName(req.to);
  const dataUrl = await fetchImageAsDataUrl(req.srcUrl);

  let hint = '';
  if (cfg.mangaDetectorEnabled && cfg.mangaDetectorModelUrl) {
    const boxes = await detectMangaBoxes(dataUrl, cfg.mangaDetectorModelUrl);
    if (boxes && boxes.length > 0) {
      const rounded = boxes.map((b) =>
        [b.x, b.y, b.w, b.h].map((n) => Number(n.toFixed(3))),
      );
      hint =
        `\nA local text detector already located ${boxes.length} text region(s) at these ` +
        `normalized [x,y,w,h] positions: ${JSON.stringify(rounded)}. Report exactly these ` +
        `regions (minor adjustments allowed) with their OCR text and translations.`;
    }
  }

  const prompt =
    `You are a comic/manga translation engine. Detect every speech bubble, caption ` +
    `and sound-effect region containing text in this image, OCR each region, and ` +
    `translate the text into ${toName}.\n` +
    `Reply with ONLY a JSON array (no markdown fences, no commentary). Each element:\n` +
    `{"x":0.12,"y":0.05,"w":0.20,"h":0.15,"text":"original text","translation":"translated text"}\n` +
    `x,y is the top-left corner and w,h the size of the text region, all normalized ` +
    `to the image dimensions (values between 0 and 1). Boxes must tightly cover the ` +
    `text. Reply with [] if the image contains no text.` +
    hint;

  const raw = await vision(pcfg, prompt, dataUrl);
  const regions = parseMangaRegions(raw);

  if (regions === null) {
    // Model ignored the JSON contract: degrade to the whole-image translation.
    const fallback = await translateImage({ srcUrl: req.srcUrl, to: req.to });
    return { regions: [], fallbackText: fallback.text };
  }
  if (regions.length === 0) return { regions: [] };

  try {
    const rendered = await renderMangaImage(dataUrl, regions);
    return { regions, dataUrl: rendered };
  } catch {
    // Canvas failure (odd formats etc.): still return the text regions so the
    // caller can show them as an overlay list.
    const text = regions.map((r) => r.translation).join('\n');
    return { regions, fallbackText: text };
  }
}

async function openExtensionPage(page: 'options' | 'pdf-viewer' | 'text-translate' | 'shortcuts') {
  if (page === 'options') {
    await browser.runtime.openOptionsPage();
    return;
  }
  if (page === 'shortcuts') {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    return;
  }
  await browser.tabs.create({ url: browser.runtime.getURL(`/${page}.html`) });
}

async function sendToActiveTab(type: string, payload: unknown = undefined) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return;
  try {
    await browser.tabs.sendMessage(tab.id, { __tx: true, scope: 'cs', type, payload });
  } catch {
    // content script not available on this page (chrome://, web store, etc.)
  }
}

const RULES_ALARM = 'tx-refresh-rules';

export default defineBackground(() => {
  void cache.ensureLoaded();
  startConfigSync();

  // Silent daily refresh of the site-rule subscription (no-op when unset).
  void browser.alarms?.create(RULES_ALARM, { periodInMinutes: 60 * 24, delayInMinutes: 3 });
  browser.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === RULES_ALARM) void refreshSubscribedRules();
  });

  onBackgroundMessage({
    translateBatch: (req) => translateBatch(req),
    refineBatch: (req) => refineBatch(req),

    detectLanguage: async ({ text }) => {
      const guess = detectLangHeuristic(text);
      if (guess === 'zh' || guess === 'ja' || guess === 'ko' || guess === 'ru' || guess === 'ar') {
        return { lang: guess };
      }
      try {
        return { lang: await googleDetect(text) };
      } catch {
        return { lang: guess === 'latin' ? 'en' : 'auto' };
      }
    },

    testProvider: async ({ provider }) => {
      const cfg = await loadConfig();
      return getProvider(provider).test(cfg.providers[provider] ?? {});
    },

    listModels: async ({ provider }) => {
      const cfg = await loadConfig();
      if (provider === 'ollama') {
        return { models: await listOllamaModels(cfg.providers.ollama ?? {}) };
      }
      const res = await getProvider(provider).test(cfg.providers[provider] ?? {});
      return { models: res.models ?? [] };
    },

    openPage: async ({ page }) => {
      await openExtensionPage(page);
    },

    getCacheStats: async () => {
      await cache.ensureLoaded();
      return cache.stats();
    },

    clearCache: async () => {
      await cache.clear();
    },

    buildPageContext: (req) => buildPageContext(req),
    translateImage: (req) => translateImage(req),
    translateMangaImage: (req) => translateMangaImage(req),
  });

  // ---- streaming translation port (text translate page) ----
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PORT_NAME) return;
    port.onMessage.addListener(async (raw: unknown) => {
      const req = raw as StreamTranslateReq;
      const send = (ev: StreamEvent) => {
        try {
          port.postMessage(ev);
        } catch {
          // port closed by client
        }
      };
      try {
        const cfg = await loadConfig();
        const providerId = req.provider ?? cfg.provider;
        const provider = getProvider(providerId);
        const pcfg = cfg.providers[providerId] ?? {};
        const expert = getExpert(cfg, req.expertId ?? cfg.expertId);
        const out = await provider.translate([req.text], req.from, req.to, pcfg, {
          expert,
          onDelta: provider.supportsStream ? (d) => send({ kind: 'delta', text: d }) : undefined,
        });
        const full = out[0];
        if (typeof full === 'string' && full.length > 0) send({ kind: 'done', full });
        else send({ kind: 'error', message: '翻译服务未返回内容' });
      } catch (err) {
        send({ kind: 'error', message: classifyError(err).message });
      }
    });
  });

  // ---- context menus ----
  browser.runtime.onInstalled.addListener(() => {
    void browser.contextMenus.removeAll().then(() => {
      browser.contextMenus.create({
        id: 'tx-translate-selection',
        title: '翻译选中文字',
        contexts: ['selection'],
      });
      browser.contextMenus.create({
        id: 'tx-translate-page',
        title: '翻译整个页面',
        contexts: ['page'],
      });
      browser.contextMenus.create({
        id: 'tx-translate-image',
        title: '翻译图片中的文字（AI）',
        contexts: ['image'],
      });
      browser.contextMenus.create({
        id: 'tx-translate-image-fill',
        title: '翻译并回填图片文字（AI）',
        contexts: ['image'],
      });
    });
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (tab?.id == null) return;
    if (info.menuItemId === 'tx-translate-selection') {
      void browser.tabs.sendMessage(tab.id, {
        __tx: true,
        scope: 'cs',
        type: 'translateSelection',
        payload: { text: info.selectionText },
      }).catch(() => undefined);
    } else if (info.menuItemId === 'tx-translate-page') {
      void browser.tabs.sendMessage(tab.id, {
        __tx: true,
        scope: 'cs',
        type: 'translatePage',
        payload: undefined,
      }).catch(() => undefined);
    } else if (info.menuItemId === 'tx-translate-image' && info.srcUrl) {
      void browser.tabs.sendMessage(tab.id, {
        __tx: true,
        scope: 'cs',
        type: 'translateImage',
        payload: { srcUrl: info.srcUrl },
      }).catch(() => undefined);
    } else if (info.menuItemId === 'tx-translate-image-fill' && info.srcUrl) {
      void browser.tabs.sendMessage(tab.id, {
        __tx: true,
        scope: 'cs',
        type: 'translateImageFill',
        payload: { srcUrl: info.srcUrl },
      }).catch(() => undefined);
    }
  });

  // ---- keyboard commands ----
  browser.commands?.onCommand.addListener((command) => {
    if (command === 'translate-page') void sendToActiveTab('translatePage');
    else if (command === 'toggle-hover') {
      void loadConfig().then((cfg) => saveConfig({ hoverEnabled: !cfg.hoverEnabled }));
    } else if (command === 'toggle-selection') {
      void loadConfig().then((cfg) => saveConfig({ selectionEnabled: !cfg.selectionEnabled }));
    }
  });
});
