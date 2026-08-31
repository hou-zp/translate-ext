import { browser } from 'wxt/browser';
import type { AppConfig } from '../core/config';
import type { PageTranslationController } from './controller';
import { fadeOutRemove, overlayRoot, pathHasClass } from './overlay';

const PANEL_HEIGHT = 544;

/**
 * The floating ball docked at the right edge of the page. Opens the full
 * extension panel (the popup page, embedded in an iframe) so every feature
 * is available without reaching for the toolbar icon. Draggable vertically;
 * hidden when disabled in config. Rendered inside the overlay shadow root.
 */
export class FloatBall {
  private ball: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private topPercent = 38;
  private dragging = false;

  constructor(
    private controller: PageTranslationController,
    private getConfig: () => AppConfig | null,
  ) {
    document.addEventListener('mousedown', (e) => {
      if (!pathHasClass(e, 'txe-ball', 'txe-ball-frame')) this.closePanel();
    });
    // the embedded popup asks us to close it (after translate / opening pages)
    window.addEventListener('message', (e) => {
      if ((e.data as { __txe?: string } | null)?.__txe === 'close-panel') this.closePanel();
    });
  }

  sync(): void {
    const cfg = this.getConfig();
    const shouldShow = !!cfg?.floatButtonEnabled;
    if (shouldShow && !this.ball) this.mount();
    else if (!shouldShow && this.ball) this.unmount();
  }

  private mount(): void {
    const ball = document.createElement('div');
    ball.className = 'txe-ball';
    ball.textContent = '译';
    ball.style.top = `${this.topPercent}%`;
    ball.title = 'AI 翻译';

    let moved = false;
    ball.addEventListener('mousedown', (e) => {
      this.dragging = true;
      moved = false;
      e.preventDefault();
      const onMove = (me: MouseEvent) => {
        if (!this.dragging) return;
        moved = true;
        ball.classList.add('txe-dragging');
        this.closePanel();
        const pct = Math.min(92, Math.max(4, (me.clientY / window.innerHeight) * 100));
        this.topPercent = pct;
        ball.style.top = `${pct}%`;
      };
      const onUp = () => {
        this.dragging = false;
        ball.classList.remove('txe-dragging');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
    ball.addEventListener('click', () => {
      if (moved) return;
      if (this.panel) this.closePanel();
      else this.openPanel();
    });

    overlayRoot().appendChild(ball);
    this.ball = ball;
  }

  private unmount(): void {
    this.ball?.remove();
    this.ball = null;
    this.closePanel();
  }

  private openPanel(): void {
    this.closePanel();
    const panel = document.createElement('div');
    panel.className = 'txe-ball-frame';
    // keep the whole panel inside the viewport, aligned with the ball
    const ballY = (this.topPercent / 100) * window.innerHeight;
    const top = Math.min(Math.max(8, ballY - 20), window.innerHeight - PANEL_HEIGHT - 8);
    panel.style.top = `${Math.max(8, top)}px`;
    panel.addEventListener('mousedown', (e) => e.stopPropagation());

    const iframe = document.createElement('iframe');
    iframe.src = browser.runtime.getURL('/popup.html');
    iframe.setAttribute('allow', 'clipboard-write');
    panel.appendChild(iframe);

    overlayRoot().appendChild(panel);
    this.panel = panel;
  }

  private closePanel(): void {
    if (this.panel) fadeOutRemove(this.panel);
    this.panel = null;
  }
}
