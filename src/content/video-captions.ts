import type { AppConfig } from '../core/config';
import { sendToBackground } from '../core/messaging';
import {
  CAPTION_BG,
  CAPTION_FONT_TRANS,
  CAPTION_PADDING,
  CAPTION_RADIUS,
  CAPTION_TRANS_COLOR,
} from './caption-style';
import { stripMarkers } from './walker';

/**
 * Generic bilingual captions for video sites and web meetings.
 *
 * Unlike YouTube (which exposes full caption tracks up front), most players
 * only render the current cue into the DOM. This watcher observes the native
 * caption element, translates each cue as it appears and overlays the
 * translation near the native captions.
 */

export interface CaptionAdapter {
  id: string;
  /** hostname suffixes this adapter applies to */
  hosts: string[];
  /** element(s) whose textContent is the caption currently on screen */
  captionSelector: string;
  /** video: overlay anchored to the <video>; meeting: fixed bar above the window bottom */
  kind: 'video' | 'meeting';
}

export const CAPTION_ADAPTERS: CaptionAdapter[] = [
  {
    id: 'netflix',
    hosts: ['netflix.com'],
    captionSelector: '.player-timedtext-text-container',
    kind: 'video',
  },
  {
    id: 'bilibili',
    hosts: ['bilibili.com'],
    captionSelector:
      '.bpx-player-subtitle-panel-text, .bpx-player-subtitle-item-text, .bilibili-player-video-subtitle .subtitle-item-text',
    kind: 'video',
  },
  {
    id: 'coursera',
    hosts: ['coursera.org'],
    captionSelector: '.rc-CaptionsRenderer [class*="caption"], .vjs-text-track-cue > div',
    kind: 'video',
  },
  {
    id: 'udemy',
    hosts: ['udemy.com'],
    captionSelector: '[data-purpose="captions-cue-text"]',
    kind: 'video',
  },
  {
    id: 'primevideo',
    hosts: ['primevideo.com'],
    captionSelector: '.atvwebplayersdk-captions-text',
    kind: 'video',
  },
  {
    id: 'disneyplus',
    hosts: ['disneyplus.com'],
    captionSelector:
      '.dss-subtitle-renderer-cue-window, .hive-subtitle-renderer-cue-window',
    kind: 'video',
  },
  {
    id: 'vimeo',
    hosts: ['vimeo.com'],
    captionSelector: '.vp-captions-line, .vp-captions cue, .vp-captions',
    kind: 'video',
  },
  {
    id: 'meet',
    hosts: ['meet.google.com'],
    captionSelector: '[jsname="tgaKEf"], [jsname="YSxPC"] [jsname="tgaKEf"]',
    kind: 'meeting',
  },
  {
    id: 'zoom',
    hosts: ['zoom.us', 'zoomgov.com'],
    captionSelector:
      '#live-transcription-subtitle, .live-transcription-subtitle__item, [class*="live-transcription"] span',
    kind: 'meeting',
  },
  {
    id: 'teams',
    hosts: ['teams.microsoft.com', 'teams.live.com'],
    captionSelector: '[data-tid="closed-caption-text"]',
    kind: 'meeting',
  },
];

export function findCaptionAdapter(host: string): CaptionAdapter | null {
  const h = host.toLowerCase();
  for (const a of CAPTION_ADAPTERS) {
    if (a.hosts.some((s) => h === s || h.endsWith('.' + s))) return a;
  }
  return null;
}

const CACHE_MAX = 300;

export class VideoCaptionWatcher {
  private adapter: CaptionAdapter | null;
  private observer: MutationObserver | null = null;
  private overlay: HTMLElement | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private lastSource = '';
  private seq = 0;
  private cache = new Map<string, string>();
  private repositionTimer: ReturnType<typeof setInterval> | undefined;

  constructor(private getConfig: () => AppConfig | null) {
    this.adapter = findCaptionAdapter(location.hostname);
    this.sync();
  }

  /** Re-evaluate after a config change. */
  sync(): void {
    if (!this.adapter) return;
    const cfg = this.getConfig();
    const enabled =
      this.adapter.kind === 'video'
        ? (cfg?.videoSubtitlesEnabled ?? false)
        : (cfg?.meetingCaptionsEnabled ?? false);
    if (enabled && !this.observer) this.start();
    else if (!enabled && this.observer) this.stop();
  }

  destroy(): void {
    this.stop();
  }

  private start(): void {
    if (!document.body) return;
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    // players resize / go fullscreen: keep the overlay glued to the video
    this.repositionTimer = setInterval(() => this.position(), 1200);
    this.schedule();
  }

  private stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.repositionTimer) clearInterval(this.repositionTimer);
    this.overlay?.remove();
    this.overlay = null;
    this.lastSource = '';
  }

  private schedule(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    // meetings stream words incrementally; wait a beat longer for a stable cue
    const delay = this.adapter?.kind === 'meeting' ? 350 : 120;
    this.debounceTimer = setTimeout(() => this.tick(), delay);
  }

  private currentCaption(): string {
    if (!this.adapter) return '';
    const els = document.querySelectorAll(this.adapter.captionSelector);
    if (els.length === 0) return '';
    if (this.adapter.kind === 'meeting') {
      // meetings append caption blocks; only the last one is live
      const last = els[els.length - 1];
      return (last?.textContent ?? '').replace(/\s+/g, ' ').trim();
    }
    const parts: string[] = [];
    els.forEach((el) => {
      // skip our own overlay if the selector is loose
      if (el.closest('.txe-cap-overlay')) return;
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (text) parts.push(text);
    });
    return parts.join(' ');
  }

  private tick(): void {
    const text = this.currentCaption();
    if (text === this.lastSource) return;
    this.lastSource = text;
    if (!text) {
      this.hide();
      return;
    }
    const cached = this.cache.get(text);
    if (cached !== undefined) {
      this.show(cached);
      return;
    }
    this.show(''); // reserve space immediately, fill when the translation lands
    void this.translate(text);
  }

  private async translate(text: string): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) return;
    const mySeq = ++this.seq;
    try {
      const res = await sendToBackground('translateBatch', {
        texts: [text],
        from: 'auto',
        to: cfg.targetLang,
        expertId: cfg.expertId,
      });
      const out = res.results[0] ? stripMarkers(res.results[0]) : '';
      if (out) {
        this.cache.set(text, out);
        if (this.cache.size > CACHE_MAX) {
          const first = this.cache.keys().next().value;
          if (first !== undefined) this.cache.delete(first);
        }
      }
      // only render if this cue is still the one on screen
      if (mySeq === this.seq && this.lastSource === text) this.show(out);
    } catch {
      // next cue change will retry naturally
    }
  }

  private ensureOverlay(): HTMLElement {
    if (this.overlay?.isConnected) return this.overlay;
    this.overlay?.remove();
    const el = document.createElement('div');
    el.className = 'txe-cap-overlay';
    Object.assign(el.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '80%',
      zIndex: '2147483646',
      pointerEvents: 'none',
      textAlign: 'center',
      display: 'none',
      background: CAPTION_BG,
      color: CAPTION_TRANS_COLOR,
      font: CAPTION_FONT_TRANS,
      padding: CAPTION_PADDING,
      borderRadius: CAPTION_RADIUS,
      whiteSpace: 'pre-wrap',
    } satisfies Partial<CSSStyleDeclaration>);
    document.documentElement.appendChild(el);
    this.overlay = el;
    return el;
  }

  private position(): void {
    if (!this.overlay || this.overlay.style.display === 'none') return;
    if (this.adapter?.kind === 'meeting') {
      this.overlay.style.bottom = '110px';
      this.overlay.style.top = '';
      return;
    }
    const video = document.querySelector('video');
    const rect = video?.getBoundingClientRect();
    if (rect && rect.height > 100) {
      // sit just above the native caption area at the bottom of the player
      this.overlay.style.top = `${Math.max(0, rect.bottom - 118)}px`;
      this.overlay.style.bottom = '';
    } else {
      this.overlay.style.bottom = '96px';
      this.overlay.style.top = '';
    }
  }

  private show(translation: string): void {
    const el = this.ensureOverlay();
    if (!translation) {
      // cue known but translation still in flight: keep the overlay hidden
      el.style.display = 'none';
      return;
    }
    el.textContent = translation;
    el.style.display = 'block';
    this.position();
  }

  private hide(): void {
    if (this.overlay) this.overlay.style.display = 'none';
  }
}
