import { computePosition, flip, offset, shift } from '@floating-ui/dom';
import type { AppConfig } from '../core/config';
import { addFavorite } from '../core/favorites';
import { t } from '../core/i18n';
import { sendToBackground } from '../core/messaging';
import { PROVIDERS } from '../providers';
import { stripMarkers } from './walker';

interface VirtualEl {
  getBoundingClientRect: () => DOMRect;
}

/**
 * Selection translation: after selecting text a small trigger appears;
 * clicking it opens a bubble with the translation, copy and speak actions.
 */
export class SelectionBubble {
  private trigger: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private currentText = '';

  constructor(private getConfig: () => AppConfig | null) {
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousedown', this.onMouseDown, true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideAll();
    });
  }

  /** Entry point for the context-menu "translate selection" action. */
  async translateCurrentSelection(textOverride?: string): Promise<void> {
    const sel = window.getSelection();
    const text = (textOverride ?? sel?.toString() ?? '').trim();
    if (!text) return;
    const anchor = this.selectionAnchor() ?? this.centerAnchor();
    await this.openPanel(text, anchor);
  }

  private onMouseDown = (ev: MouseEvent): void => {
    const target = ev.target as Element | null;
    if (target?.closest('.txe-sel-panel, .txe-sel-trigger')) return;
    this.hideAll();
  };

  private onMouseUp = (ev: MouseEvent): void => {
    const cfg = this.getConfig();
    if (!cfg?.selectionEnabled) return;
    const target = ev.target as Element | null;
    if (target?.closest('.txe-sel-panel, .txe-sel-trigger, .txe-ball, .txe-ball-panel')) return;
    // wait for the selection to settle
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || text.length > 3000) return;
      const editable = (ev.target as HTMLElement | null)?.closest?.(
        'input, textarea, [contenteditable="true"]',
      );
      if (editable) return;
      this.showTrigger(text);
    }, 10);
  };

  private selectionAnchor(): VirtualEl | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return null;
    return { getBoundingClientRect: () => rect };
  }

  private centerAnchor(): VirtualEl {
    const rect = new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
    return { getBoundingClientRect: () => rect };
  }

  private showTrigger(text: string): void {
    const anchor = this.selectionAnchor();
    if (!anchor) return;
    this.hideAll();
    this.currentText = text;
    const trigger = document.createElement('div');
    trigger.className = 'txe-sel-trigger';
    trigger.textContent = '译';
    trigger.addEventListener('mousedown', (e) => e.stopPropagation());
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      trigger.remove();
      this.trigger = null;
      void this.openPanel(text, anchor);
    });
    document.documentElement.appendChild(trigger);
    this.trigger = trigger;
    void computePosition(anchor as never, trigger, {
      placement: 'top',
      strategy: 'fixed',
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      trigger.style.left = `${x}px`;
      trigger.style.top = `${y}px`;
    });
  }

  private async openPanel(text: string, anchor: VirtualEl): Promise<void> {
    this.hideAll();
    const cfg = this.getConfig();
    const panel = document.createElement('div');
    panel.className = 'txe-sel-panel';
    panel.addEventListener('mousedown', (e) => e.stopPropagation());

    const head = document.createElement('div');
    head.className = 'txe-sel-head';
    const providerName = cfg ? PROVIDERS[cfg.provider]?.name ?? cfg.provider : '';
    const title = document.createElement('span');
    title.textContent = `${t('划词翻译')} · ${providerName}`;
    const close = document.createElement('span');
    close.className = 'txe-sel-close';
    close.textContent = '✕';
    close.title = t('关闭');
    close.addEventListener('click', () => this.hideAll());
    head.append(title, close);

    const body = document.createElement('div');
    body.className = 'txe-sel-body';
    const spin = document.createElement('span');
    spin.className = 'txe-loading';
    body.appendChild(spin);

    const foot = document.createElement('div');
    foot.className = 'txe-sel-foot';

    panel.append(head, body, foot);
    document.documentElement.appendChild(panel);
    this.panel = panel;

    const position = () =>
      computePosition(anchor as never, panel, {
        placement: 'bottom',
        strategy: 'fixed',
        middleware: [offset(10), flip(), shift({ padding: 10 })],
      }).then(({ x, y }) => {
        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
      });
    void position();

    try {
      const res = await sendToBackground('translateBatch', {
        texts: [text],
        from: cfg?.sourceLang ?? 'auto',
        to: cfg?.targetLang ?? 'zh-CN',
        expertId: cfg?.expertId,
      });
      if (this.panel !== panel) return; // closed meanwhile
      const out = res.results[0];
      if (out) {
        const clean = stripMarkers(out);
        body.textContent = clean;
        const copyBtn = document.createElement('button');
        copyBtn.className = 'txe-sel-btn';
        copyBtn.textContent = t('复制');
        copyBtn.addEventListener('click', () => {
          void navigator.clipboard.writeText(clean).then(() => {
            copyBtn.textContent = t('已复制');
            setTimeout(() => (copyBtn.textContent = t('复制')), 1200);
          });
        });
        const speakBtn = document.createElement('button');
        speakBtn.className = 'txe-sel-btn';
        speakBtn.textContent = t('朗读');
        speakBtn.addEventListener('click', () => {
          speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(clean);
          utter.lang = cfg?.targetLang ?? 'zh-CN';
          speechSynthesis.speak(utter);
        });
        const favBtn = document.createElement('button');
        favBtn.className = 'txe-sel-btn';
        favBtn.textContent = `☆ ${t('收藏')}`;
        favBtn.addEventListener('click', () => {
          void addFavorite({
            text,
            translation: clean,
            sourceLang: cfg?.sourceLang ?? 'auto',
            targetLang: cfg?.targetLang ?? 'zh-CN',
            host: location.hostname,
          }).then(() => {
            favBtn.textContent = `★ ${t('已收藏')}`;
            favBtn.disabled = true;
          });
        });
        foot.append(copyBtn, speakBtn, favBtn);
      } else {
        body.textContent = `${t('翻译失败')}: ${res.errors[0]?.message ?? ''}`;
      }
      void position();
    } catch (err) {
      if (this.panel !== panel) return;
      body.textContent = `${t('翻译失败')}: ${err instanceof Error ? err.message : String(err)}`;
      void position();
    }
  }

  private hideAll(): void {
    this.trigger?.remove();
    this.trigger = null;
    this.panel?.remove();
    this.panel = null;
  }
}
