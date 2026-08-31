import { t } from '../core/i18n';
import { overlayRoot } from './overlay';

/**
 * Bottom-right pill showing full-page translation progress
 * ("3/42" while translating, "✓" briefly when finished). Clicking ✕ restores
 * the original page.
 */
export class ProgressPill {
  private el: HTMLElement | null = null;
  private numEl: HTMLElement | null = null;
  private spinEl: HTMLElement | null = null;
  private doneShown = false;
  private fadeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private onCancel: () => void) {}

  update(done: number, total: number): void {
    if (total <= 0) return;
    if (done >= total) {
      this.showDone();
      return;
    }
    this.ensure();
    this.doneShown = false;
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = undefined;
    }
    if (this.spinEl) this.spinEl.style.display = '';
    if (this.numEl) {
      this.numEl.textContent = `${done}/${total}`;
      this.numEl.classList.remove('txe-progress-done');
    }
  }

  hide(): void {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = undefined;
    this.el?.remove();
    this.el = null;
    this.numEl = null;
    this.spinEl = null;
    this.doneShown = false;
  }

  private showDone(): void {
    if (!this.el || this.doneShown) {
      if (!this.el) return; // never shown: nothing to celebrate
    }
    if (this.doneShown) return;
    this.doneShown = true;
    if (this.spinEl) this.spinEl.style.display = 'none';
    if (this.numEl) {
      this.numEl.textContent = `✓ ${t('已完成')}`;
      this.numEl.classList.add('txe-progress-done');
    }
    this.fadeTimer = setTimeout(() => {
      if (!this.el) return;
      this.el.style.opacity = '0';
      this.el.style.transform = 'translateY(6px)';
      setTimeout(() => this.hide(), 300);
    }, 1500);
  }

  private ensure(): void {
    if (this.el?.isConnected) return;
    const el = document.createElement('div');
    el.className = 'txe-progress';

    const spin = document.createElement('span');
    spin.className = 'txe-loading';

    const label = document.createElement('span');
    label.textContent = t('正在翻译');

    const num = document.createElement('span');
    num.className = 'txe-progress-num';

    const cancel = document.createElement('span');
    cancel.className = 'txe-progress-cancel';
    cancel.textContent = '✕';
    cancel.title = t('显示原文');
    cancel.addEventListener('click', () => {
      this.hide();
      this.onCancel();
    });

    el.append(spin, label, num, cancel);
    overlayRoot().appendChild(el);
    this.el = el;
    this.numEl = num;
    this.spinEl = spin;
  }
}
