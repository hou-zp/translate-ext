import type { AppConfig } from '../core/config';
import { sendToBackground } from '../core/messaging';
import { stripMarkers } from './walker';

const TRIPLE_WINDOW_MS = 650;

type EditableTarget = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

function editableFrom(target: EventTarget | null): EditableTarget | null {
  if (!(target instanceof HTMLElement)) return null;
  if (target instanceof HTMLInputElement) {
    const ok = ['text', 'search', 'url', 'email', ''].includes(target.type ?? 'text');
    return ok && !target.readOnly && !target.disabled ? target : null;
  }
  if (target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled ? target : null;
  }
  if (target.isContentEditable) return target;
  return null;
}

function readValue(el: EditableTarget): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value;
  return el.textContent ?? '';
}

function writeValue(el: EditableTarget, value: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Go through the native setter so React/Vue controlled inputs pick it up.
    const proto =
      el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    const end = value.length;
    try {
      el.setSelectionRange(end, end);
    } catch {
      // some input types don't support selection
    }
  } else {
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    // move the caret to the end
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

/**
 * Triple-space input translation: type in your native language inside any
 * input / textarea / contenteditable, press space three times quickly, and
 * the text is replaced with its translation (target configurable, default en).
 */
export class InputTranslator {
  private presses: number[] = [];
  private busyEl: EditableTarget | null = null;

  constructor(private getConfig: () => AppConfig | null) {
    document.addEventListener('keydown', this.onKeyDown, true);
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    const cfg = this.getConfig();
    if (!cfg?.inputTranslateEnabled) return;
    const el = editableFrom(ev.target);
    if (!el || el === this.busyEl) return;

    if (ev.key !== ' ' && ev.code !== 'Space') {
      this.presses = [];
      return;
    }
    const now = Date.now();
    this.presses = this.presses.filter((t) => now - t < TRIPLE_WINDOW_MS);
    this.presses.push(now);
    if (this.presses.length < 3) return;
    this.presses = [];

    const raw = readValue(el);
    // the first two spaces are already in the value; strip the tail
    const text = raw.replace(/[\s\u00a0]+$/, '');
    if (!text || text.length > 4000) return;

    ev.preventDefault();
    ev.stopPropagation();
    void this.translateInto(el, text, cfg);
  };

  private async translateInto(el: EditableTarget, text: string, cfg: AppConfig): Promise<void> {
    this.busyEl = el;
    const original = readValue(el);
    try {
      const res = await sendToBackground('translateBatch', {
        texts: [text],
        from: 'auto',
        to: cfg.inputTranslateLang || 'en',
        expertId: cfg.expertId,
      });
      const out = res.results[0];
      // only replace if the user hasn't typed anything else meanwhile
      if (out && readValue(el) === original) {
        writeValue(el, stripMarkers(out));
      }
    } catch {
      // leave the original text untouched on failure
    } finally {
      this.busyEl = null;
    }
  }
}
