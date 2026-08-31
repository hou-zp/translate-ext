import type { AppConfig } from '../core/config';
import { t } from '../core/i18n';
import { sendToBackground } from '../core/messaging';

/**
 * Experimental manga/comic mode: batch-translate every large image on the
 * page with the multimodal model and overlay the translation on the bottom
 * edge of each image. Toggled from the popup.
 */

const MIN_SIZE = 220; // px, rendered size threshold for "content" images
const MAX_IMAGES = 30;
const CONCURRENCY = 2;

interface MangaOverlay {
  img: HTMLImageElement;
  box: HTMLElement;
}

let overlays: MangaOverlay[] = [];
let active = false;
let session = 0;

function collectImages(): HTMLImageElement[] {
  const imgs = Array.from(document.querySelectorAll('img'));
  const picked = imgs.filter((img) => {
    const r = img.getBoundingClientRect();
    if (r.width < MIN_SIZE || r.height < MIN_SIZE) return false;
    const src = img.currentSrc || img.src;
    return !!src && !src.startsWith('data:image/svg');
  });
  // viewport-first: translate what the reader is looking at before the rest
  picked.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    const va = ra.bottom > 0 && ra.top < innerHeight ? 0 : 1;
    const vb = rb.bottom > 0 && rb.top < innerHeight ? 0 : 1;
    return va - vb || ra.top - rb.top;
  });
  return picked.slice(0, MAX_IMAGES);
}

function makeBox(img: HTMLImageElement): HTMLElement {
  const box = document.createElement('div');
  box.className = 'txe-manga-box';
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  Object.assign(box.style, {
    position: 'absolute',
    zIndex: '2147483645',
    background: dark ? 'rgba(22,30,48,0.94)' : 'rgba(255,255,255,0.94)',
    color: dark ? '#e8edf6' : '#1a1a1a',
    font: '500 13px/1.5 system-ui, sans-serif',
    padding: '6px 10px',
    borderRadius: '8px',
    boxShadow: dark ? '0 1px 6px rgba(0,0,0,0.5)' : '0 1px 6px rgba(0,0,0,0.25)',
    maxHeight: '45%',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    opacity: '0',
    transition: 'opacity 0.2s ease',
  } satisfies Partial<CSSStyleDeclaration>);
  box.textContent = `${t('正在识别')}…`;
  positionBox(img, box);
  document.body.appendChild(box);
  requestAnimationFrame(() => (box.style.opacity = '1'));
  return box;
}

function positionBox(img: HTMLImageElement, box: HTMLElement): void {
  const r = img.getBoundingClientRect();
  box.style.left = `${r.left + scrollX + 6}px`;
  box.style.top = `${r.bottom + scrollY - Math.min(r.height * 0.45, box.offsetHeight || 60) - 6}px`;
  box.style.maxWidth = `${Math.max(120, r.width - 12)}px`;
}

function repositionAll(): void {
  for (const { img, box } of overlays) {
    if (img.isConnected) positionBox(img, box);
  }
}

async function translateOne(cfg: AppConfig, o: MangaOverlay, mySession: number): Promise<void> {
  try {
    const src = o.img.currentSrc || o.img.src;
    const res = await sendToBackground('translateImage', { srcUrl: src, to: cfg.targetLang });
    if (!active || mySession !== session) return;
    if (res.text === '[no text]') {
      o.box.remove();
      overlays = overlays.filter((x) => x !== o);
    } else {
      o.box.textContent = res.text;
      positionBox(o.img, o.box);
    }
  } catch (err) {
    if (!active || mySession !== session) return;
    const msg = err instanceof Error ? err.message : String(err);
    o.box.textContent = `${t('翻译失败')}: ${msg}`;
    o.box.style.color = '#dc2626';
  }
}

export function mangaModeActive(): boolean {
  return active;
}

/** Toggle manga mode. Returns the new state and how many images were queued. */
export async function toggleMangaMode(cfg: AppConfig): Promise<{ active: boolean; images: number }> {
  if (active) {
    stopMangaMode();
    return { active: false, images: 0 };
  }
  const imgs = collectImages();
  if (imgs.length === 0) return { active: false, images: 0 };

  active = true;
  const mySession = ++session;
  overlays = imgs.map((img) => ({ img, box: makeBox(img) }));
  addEventListener('resize', repositionAll);
  addEventListener('scroll', repositionAll, { passive: true });

  // bounded concurrency: multimodal calls are slow and expensive
  const queue = [...overlays];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0 && active && mySession === session) {
      const o = queue.shift();
      if (o) await translateOne(cfg, o, mySession);
    }
  });
  void Promise.all(workers);
  return { active: true, images: imgs.length };
}

export function stopMangaMode(): void {
  active = false;
  session++;
  for (const { box } of overlays) box.remove();
  overlays = [];
  removeEventListener('resize', repositionAll);
  removeEventListener('scroll', repositionAll);
}
