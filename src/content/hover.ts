import type { AppConfig } from '../core/config';
import { sendToBackground } from '../core/messaging';
import { isOverlayHost } from './overlay';
import { createEntry, type ParagraphRenderer } from './renderer';
import { collectParagraphs } from './walker';

const BLOCK_SELECTOR =
  'p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, figcaption, td, th, caption, div, article, section, summary';

/**
 * Hover translation: while enabled (optionally gated behind a modifier key),
 * hovering a paragraph translates just that paragraph in place.
 */
export class HoverTranslator {
  private lastTarget: Element | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | undefined;
  private handled = new WeakSet<Element>();

  constructor(
    private renderer: ParagraphRenderer,
    private getConfig: () => AppConfig | null,
  ) {
    document.addEventListener('mousemove', this.onMouseMove, { passive: true });
  }

  private modifierHeld(ev: MouseEvent, cfg: AppConfig): boolean {
    switch (cfg.hoverModifier) {
      case 'shift':
        return ev.shiftKey;
      case 'alt':
        return ev.altKey;
      case 'ctrl':
        return ev.ctrlKey || ev.metaKey;
      default:
        return true;
    }
  }

  private onMouseMove = (ev: MouseEvent): void => {
    const cfg = this.getConfig();
    if (!cfg?.hoverEnabled) return;
    if (!this.modifierHeld(ev, cfg)) return;
    if (this.throttleTimer) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = undefined;
    }, 150);

    const target = ev.target as Element | null;
    if (!target || !(target instanceof Element)) return;
    if (isOverlayHost(target) || target.closest('.txe-t')) return;
    const block = target.closest(BLOCK_SELECTOR);
    if (!block || block === this.lastTarget) return;
    this.lastTarget = block;
    void this.translateBlock(block, cfg);
  };

  private async translateBlock(block: Element, cfg: AppConfig): Promise<void> {
    if (this.handled.has(block)) return;
    // Only translate "leaf-ish" blocks on hover to avoid swallowing a whole article <div>.
    if (block.querySelectorAll(BLOCK_SELECTOR).length > 3) return;
    const paragraphs = collectParagraphs(block, cfg.targetLang, this.handled);
    if (paragraphs.length === 0 || paragraphs.length > 4) return;
    this.handled.add(block);

    // brief highlight so the user sees which paragraph is being translated
    block.classList.add('txe-hover-hint');
    setTimeout(() => block.classList.remove('txe-hover-hint'), 1200);

    const entries = paragraphs.map(createEntry);
    for (const e of entries) this.renderer.showLoading(e);
    try {
      const res = await sendToBackground('translateBatch', {
        texts: paragraphs.map((p) => p.source),
        from: cfg.sourceLang,
        to: cfg.targetLang,
        expertId: cfg.expertId,
      });
      entries.forEach((entry, i) => {
        const out = res.results[i];
        if (out) {
          this.renderer.render(entry, out);
          this.handled.add(entry.paragraph.container);
        } else {
          this.renderer.showError(entry, res.errors[i]?.message ?? '未知错误', () => {
            this.handled.delete(block);
            void this.translateBlock(block, cfg);
          });
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      entries.forEach((entry) => {
        this.renderer.showError(entry, message, () => {
          this.handled.delete(block);
          void this.translateBlock(block, cfg);
        });
      });
    }
  }
}
