import type { AppConfig } from '../core/config';
import { sendToBackground } from '../core/messaging';
import {
  CAPTION_BG,
  CAPTION_FONT_ORIG,
  CAPTION_FONT_TRANS,
  CAPTION_ORIG_COLOR,
  CAPTION_PADDING,
  CAPTION_RADIUS,
  CAPTION_TRANS_COLOR,
} from './caption-style';
import { stripMarkers } from './walker';

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // 'asr' = auto-generated
  name?: { simpleText?: string; runs?: { text: string }[] };
}

interface Cue {
  start: number; // ms
  end: number;
  text: string;
}

const CHUNK_SIZE = 30;

function isWatchPage(): boolean {
  return location.hostname.endsWith('youtube.com') && location.pathname === '/watch';
}

/** Extract available caption tracks from the watch page HTML. */
async function fetchCaptionTracks(url: string): Promise<CaptionTrack[]> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) return [];
  const html = await res.text();
  const m = html.match(/"captionTracks":(\[.*?\])(?=,"(?:audioTracks|translationLanguages)")/);
  if (!m?.[1]) return [];
  try {
    const tracks = JSON.parse(m[1]) as CaptionTrack[];
    return tracks.filter((t) => typeof t.baseUrl === 'string');
  } catch {
    return [];
  }
}

function pickTrack(tracks: CaptionTrack[], targetLang: string): CaptionTrack | null {
  if (tracks.length === 0) return null;
  const tgt = targetLang.split('-')[0]!.toLowerCase();
  // never pick a track that already is the target language (nothing to translate)
  const candidates = tracks.filter((t) => !t.languageCode.toLowerCase().startsWith(tgt));
  const pool = candidates.length > 0 ? candidates : tracks;
  return pool.find((t) => t.kind !== 'asr') ?? pool[0] ?? null;
}

async function fetchCues(track: CaptionTrack): Promise<Cue[]> {
  const sep = track.baseUrl.includes('?') ? '&' : '?';
  const res = await fetch(`${track.baseUrl}${sep}fmt=json3`, { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    events?: { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }[];
  };
  const cues: Cue[] = [];
  for (const ev of data.events ?? []) {
    const text = (ev.segs ?? [])
      .map((s) => s.utf8 ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text || ev.tStartMs == null) continue;
    cues.push({ start: ev.tStartMs, end: ev.tStartMs + (ev.dDurationMs ?? 4000), text });
  }
  return cues;
}

/**
 * Bilingual subtitles for YouTube: reads the video's caption track, translates
 * it chunk-by-chunk on demand and overlays original + translation on the
 * player (works in fullscreen since the overlay lives inside the player).
 */
export class YouTubeSubtitles {
  private cues: Cue[] = [];
  private translations: (string | null)[] = [];
  private requestedChunks = new Set<number>();
  private overlay: HTMLElement | null = null;
  private video: HTMLVideoElement | null = null;
  private lastShownIdx = -2;
  private videoId = '';
  private disposed = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private getConfig: () => AppConfig | null) {
    document.addEventListener('yt-navigate-finish', this.onNavigate);
    this.onNavigate();
  }

  destroy(): void {
    this.disposed = true;
    document.removeEventListener('yt-navigate-finish', this.onNavigate);
    this.teardown();
  }

  private onNavigate = (): void => {
    const cfg = this.getConfig();
    if (this.disposed || !cfg?.youtubeSubtitlesEnabled || !isWatchPage()) {
      this.teardown();
      return;
    }
    const id = new URLSearchParams(location.search).get('v') ?? '';
    if (!id || id === this.videoId) return;
    this.teardown();
    this.videoId = id;
    void this.setup(id);
  };

  /** Re-evaluate after a config change (toggle turned on/off). */
  sync(): void {
    const cfg = this.getConfig();
    if (!cfg?.youtubeSubtitlesEnabled) {
      this.teardown();
      this.videoId = '';
    } else if (isWatchPage() && !this.overlay) {
      this.videoId = '';
      this.onNavigate();
    }
  }

  private async setup(videoId: string): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) return;
    const tracks = await fetchCaptionTracks(location.href);
    if (this.videoId !== videoId || this.disposed) return;
    const track = pickTrack(tracks, cfg.targetLang);
    if (!track) return; // no captions on this video
    const cues = await fetchCues(track);
    if (this.videoId !== videoId || this.disposed || cues.length === 0) return;

    this.cues = cues;
    this.translations = new Array(cues.length).fill(null);
    this.requestedChunks.clear();
    this.attachToPlayer(videoId);
  }

  private attachToPlayer(videoId: string, attempt = 0): void {
    if (this.videoId !== videoId || this.disposed) return;
    const player = document.querySelector<HTMLElement>('#movie_player');
    const video = player?.querySelector<HTMLVideoElement>('video');
    if (!player || !video) {
      if (attempt < 20) {
        this.retryTimer = setTimeout(() => this.attachToPlayer(videoId, attempt + 1), 500);
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'txe-yt-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      left: '50%',
      bottom: '72px',
      transform: 'translateX(-50%)',
      maxWidth: '86%',
      zIndex: '60',
      pointerEvents: 'none',
      textAlign: 'center',
      display: 'none',
    } satisfies Partial<CSSStyleDeclaration>);

    const orig = document.createElement('div');
    Object.assign(orig.style, {
      display: 'inline-block',
      background: CAPTION_BG,
      color: CAPTION_ORIG_COLOR,
      font: CAPTION_FONT_ORIG,
      padding: CAPTION_PADDING,
      borderRadius: CAPTION_RADIUS,
      whiteSpace: 'pre-wrap',
    } satisfies Partial<CSSStyleDeclaration>);

    const trans = document.createElement('div');
    Object.assign(trans.style, {
      display: 'inline-block',
      background: CAPTION_BG,
      color: CAPTION_TRANS_COLOR,
      font: CAPTION_FONT_TRANS,
      padding: CAPTION_PADDING,
      borderRadius: CAPTION_RADIUS,
      marginTop: '4px',
      whiteSpace: 'pre-wrap',
    } satisfies Partial<CSSStyleDeclaration>);

    overlay.append(orig, document.createElement('br'), trans);
    player.appendChild(overlay);
    this.overlay = overlay;
    this.video = video;
    video.addEventListener('timeupdate', this.onTimeUpdate);
    this.onTimeUpdate();
  }

  private onTimeUpdate = (): void => {
    if (!this.video || !this.overlay) return;
    const t = this.video.currentTime * 1000;
    const idx = this.findCueIndex(t);
    this.ensureChunk(idx);

    if (idx === this.lastShownIdx && idx >= 0) {
      // refresh translation if it arrived since last render
      const transEl = this.overlay.children[2] as HTMLElement | undefined;
      if (transEl && idx >= 0 && this.translations[idx] && !transEl.textContent) {
        transEl.textContent = this.translations[idx];
        transEl.style.display = 'inline-block';
      }
      return;
    }
    this.lastShownIdx = idx;

    if (idx < 0) {
      this.overlay.style.display = 'none';
      return;
    }
    const cue = this.cues[idx]!;
    const origEl = this.overlay.children[0] as HTMLElement;
    const transEl = this.overlay.children[2] as HTMLElement;
    origEl.textContent = cue.text;
    const tr = this.translations[idx];
    transEl.textContent = tr ?? '';
    transEl.style.display = tr ? 'inline-block' : 'none';
    this.overlay.style.display = 'block';
  };

  private findCueIndex(t: number): number {
    // binary search over cue start times
    let lo = 0;
    let hi = this.cues.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (this.cues[mid]!.start <= t) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (ans >= 0 && t <= this.cues[ans]!.end) return ans;
    return -1;
  }

  /** Translate the chunk containing cue `idx` plus the next one (read-ahead). */
  private ensureChunk(idx: number): void {
    const base = idx < 0 ? 0 : Math.floor(idx / CHUNK_SIZE);
    for (const chunk of [base, base + 1]) {
      const from = chunk * CHUNK_SIZE;
      if (from >= this.cues.length || this.requestedChunks.has(chunk)) continue;
      this.requestedChunks.add(chunk);
      void this.translateChunk(chunk);
    }
  }

  private async translateChunk(chunk: number): Promise<void> {
    const cfg = this.getConfig();
    if (!cfg) return;
    const from = chunk * CHUNK_SIZE;
    const slice = this.cues.slice(from, from + CHUNK_SIZE);
    if (slice.length === 0) return;
    try {
      const res = await sendToBackground('translateBatch', {
        texts: slice.map((c) => c.text),
        from: 'auto',
        to: cfg.targetLang,
        expertId: cfg.expertId,
      });
      res.results.forEach((r, i) => {
        if (r) this.translations[from + i] = stripMarkers(r);
      });
      // force a refresh so the current cue picks up its translation
      this.lastShownIdx = -2;
      this.onTimeUpdate();
    } catch {
      // allow a retry on the next seek into this chunk
      this.requestedChunks.delete(chunk);
    }
  }

  private teardown(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
    this.video?.removeEventListener('timeupdate', this.onTimeUpdate);
    this.video = null;
    this.overlay?.remove();
    this.overlay = null;
    this.cues = [];
    this.translations = [];
    this.requestedChunks.clear();
    this.lastShownIdx = -2;
  }
}
