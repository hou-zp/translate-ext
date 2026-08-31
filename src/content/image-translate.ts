import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { AppConfig } from '../core/config';
import { t } from '../core/i18n';
import { sendToBackground } from '../core/messaging';

let panel: HTMLElement | null = null;

function close(): void {
  panel?.remove();
  panel = null;
}

function anchorFor(srcUrl: string): { getBoundingClientRect: () => DOMRect } {
  const imgs = Array.from(document.querySelectorAll('img'));
  const img = imgs.find((i) => i.src === srcUrl || i.currentSrc === srcUrl);
  if (img) {
    const rect = img.getBoundingClientRect();
    if (rect.width > 0) return { getBoundingClientRect: () => rect };
  }
  const rect = new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
  return { getBoundingClientRect: () => rect };
}

/**
 * Context-menu image translation: OCR + translate via a multimodal model in
 * the background, result shown in a bubble anchored to the image.
 */
export async function showImageTranslation(srcUrl: string, cfg: AppConfig): Promise<void> {
  close();
  const el = document.createElement('div');
  el.className = 'txe-sel-panel';
  el.addEventListener('mousedown', (e) => e.stopPropagation());

  const head = document.createElement('div');
  head.className = 'txe-sel-head';
  const title = document.createElement('span');
  title.textContent = t('图片翻译');
  const closeBtn = document.createElement('span');
  closeBtn.className = 'txe-sel-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', close);
  head.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'txe-sel-body';
  const spin = document.createElement('span');
  spin.className = 'txe-loading';
  body.appendChild(spin);
  body.append(` ${t('正在识别图片文字')}…`);

  const foot = document.createElement('div');
  foot.className = 'txe-sel-foot';

  el.append(head, body, foot);
  document.documentElement.appendChild(el);
  panel = el;

  const anchor = anchorFor(srcUrl);
  const position = () =>
    computePosition(anchor as never, el, {
      placement: 'bottom',
      strategy: 'fixed',
      middleware: [offset(10), flip(), shift({ padding: 10 })],
    }).then(({ x, y }) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    });
  void position();

  try {
    const res = await sendToBackground('translateImage', { srcUrl, to: cfg.targetLang });
    if (panel !== el) return;
    body.textContent = res.text === '[no text]' ? t('图片中未识别到文字') : res.text;
    const copyBtn = document.createElement('button');
    copyBtn.className = 'txe-sel-btn';
    copyBtn.textContent = t('复制');
    copyBtn.addEventListener('click', () => {
      void navigator.clipboard.writeText(res.text).then(() => {
        copyBtn.textContent = t('已复制');
        setTimeout(() => (copyBtn.textContent = t('复制')), 1200);
      });
    });
    foot.appendChild(copyBtn);
  } catch (err) {
    if (panel !== el) return;
    const msg = err instanceof Error ? err.message : String(err);
    body.textContent = `${t('翻译失败')}: ${msg}`;
    const hint = document.createElement('div');
    hint.style.cssText = 'margin-top:6px;font-size:11px;opacity:.65';
    hint.textContent = t('图片翻译需要多模态模型（如 gpt-4o 或 Ollama llava）');
    body.appendChild(hint);
  }
  void position();
}
