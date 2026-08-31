import { loadConfig, onConfigChanged, type AppConfig, type SiteRule } from '../core/config';
import { sendToBackground } from '../core/messaging';
import { createEntry, ParagraphRenderer, type ParagraphEntry } from './renderer';
import { collectParagraphs } from './walker';
import { DynamicWatcher } from './observer';

const FLUSH_INTERVAL_MS = 250;
const MAX_ENTRIES_PER_FLUSH = 40;

/**
 * Orchestrates full-page translation: paragraph discovery, viewport-priority
 * scheduling, batched background requests, bilingual rendering, the optional
 * AI refine second pass, dynamic content and full restoration.
 */
export class PageTranslationController {
  active = false;
  private cfg: AppConfig | null = null;
  private entries: ParagraphEntry[] = [];
  /** dedupe key: the last node of a paragraph run */
  private seenAnchors = new WeakSet<Node>();
  private entriesByContainer = new Map<Element, ParagraphEntry[]>();
  private io: IntersectionObserver | null = null;
  private watcher: DynamicWatcher | null = null;
  private visibleQueue: ParagraphEntry[] = [];
  private queued = new Set<ParagraphEntry>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribeConfig: (() => void) | null = null;
  /** shared page summary for AI consistency (contextEnabled) */
  private pageContext: string | undefined;
  private contextPromise: Promise<void> | null = null;

  constructor(
    public renderer: ParagraphRenderer,
    private getRule: () => SiteRule | null = () => null,
  ) {}

  get doneCount(): number {
    return this.entries.filter((e) => e.state === 'done').length;
  }

  get totalCount(): number {
    return this.entries.length;
  }

  async start(): Promise<void> {
    if (this.active) return;
    this.active = true;
    this.cfg = await loadConfig();
    this.unsubscribeConfig = onConfigChanged((cfg) => {
      this.cfg = cfg;
    });

    this.io = new IntersectionObserver(
      (ioEntries) => {
        for (const ioe of ioEntries) {
          if (!ioe.isIntersecting) continue;
          const list = this.entriesByContainer.get(ioe.target as Element) ?? [];
          for (const entry of list) {
            if (entry.state === 'pending') this.enqueue(entry);
          }
          this.io?.unobserve(ioe.target);
        }
      },
      { rootMargin: '600px 0px 600px 0px' },
    );

    this.watcher = new DynamicWatcher((roots) => {
      if (!this.active) return;
      for (const root of roots) this.scan(root);
    });
    this.watcher.observe(document.body);

    this.scan(document.body);
  }

  /** Roots to scan, narrowed by the site rule's includeSelector when present. */
  private scanRoots(root: Element): Element[] {
    const include = this.getRule()?.includeSelector;
    if (!include) return [root];
    try {
      if (root.matches(include) || root.closest(include)) return [root];
      return Array.from(root.querySelectorAll(include));
    } catch {
      return [root]; // invalid selector in the site rule
    }
  }

  /** Discover paragraphs under root and register them for viewport-priority translation. */
  private scan(rawRoot: Element): void {
    if (!this.cfg || !this.io) return;
    const rule = this.getRule();
    const paragraphs = this.scanRoots(rawRoot).flatMap((root) =>
      collectParagraphs(
        root,
        this.cfg!.targetLang,
        new WeakSet(), // dedupe is handled per-anchor below, not per-container
        (sr) => this.watcher?.observe(sr),
        rule?.excludeSelector,
      ),
    );
    for (const p of paragraphs) {
      const anchor = p.nodes[p.nodes.length - 1];
      if (!anchor || this.seenAnchors.has(anchor)) continue;
      this.seenAnchors.add(anchor);
      const entry = createEntry(p);
      this.entries.push(entry);
      const list = this.entriesByContainer.get(p.container);
      if (list) list.push(entry);
      else this.entriesByContainer.set(p.container, [entry]);
      // watch the container (the anchor may be a bare text node)
      this.io.observe(p.container);
    }
    this.startContext();
  }

  /** Kick off the one-shot page summary used as shared AI context. */
  private startContext(): void {
    if (this.contextPromise || !this.cfg?.contextEnabled) return;
    const sample = this.entries
      .slice(0, 15)
      .map((e) => e.paragraph.plain)
      .join('\n')
      .slice(0, 3000);
    if (sample.length < 200) return; // not enough text to be worth a model call
    this.contextPromise = sendToBackground('buildPageContext', {
      title: document.title,
      sample,
      to: this.cfg.targetLang,
    })
      .then((r) => {
        this.pageContext = r.context || undefined;
      })
      .catch(() => {
        // context is best-effort; translate without it
      });
  }

  /** Wait briefly for the context so early batches benefit from it too. */
  private async waitContext(): Promise<void> {
    if (!this.contextPromise) return;
    await Promise.race([
      this.contextPromise,
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
  }

  private enqueue(entry: ParagraphEntry): void {
    if (this.queued.has(entry)) return;
    this.queued.add(entry);
    this.visibleQueue.push(entry);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined;
        void this.flush();
      }, FLUSH_INTERVAL_MS);
    }
  }

  private async flush(): Promise<void> {
    if (!this.active || !this.cfg) return;
    const batch = this.visibleQueue.splice(0, MAX_ENTRIES_PER_FLUSH);
    for (const e of batch) this.queued.delete(e);
    const pending = batch.filter((e) => e.state === 'pending' && e.paragraph.container.isConnected);
    if (pending.length === 0) {
      if (this.visibleQueue.length > 0) this.enqueueFlushSoon();
      return;
    }

    for (const e of pending) this.renderer.showLoading(e);
    const cfg = this.cfg;
    await this.waitContext();

    try {
      const res = await sendToBackground('translateBatch', {
        texts: pending.map((e) => e.paragraph.source),
        from: cfg.sourceLang,
        to: cfg.targetLang,
        expertId: cfg.expertId,
        context: this.pageContext,
      });
      const refineTargets: ParagraphEntry[] = [];
      pending.forEach((entry, i) => {
        if (!this.active) return;
        const translated = res.results[i];
        if (translated) {
          this.renderer.render(entry, translated);
          refineTargets.push(entry);
        } else {
          const err = res.errors[i];
          this.renderer.showError(entry, err?.message ?? '未知错误', () => {
            entry.state = 'pending';
            this.enqueue(entry);
          });
        }
      });
      if (cfg.refineEnabled && refineTargets.length > 0) {
        void this.refine(refineTargets, cfg);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      for (const entry of pending) {
        this.renderer.showError(entry, message, () => {
          entry.state = 'pending';
          this.enqueue(entry);
        });
      }
    }

    if (this.visibleQueue.length > 0) this.enqueueFlushSoon();
  }

  private enqueueFlushSoon(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  /** Second pass: polish machine translations with the AI refine pipeline. */
  private async refine(targets: ParagraphEntry[], cfg: AppConfig): Promise<void> {
    // refine in modest chunks to keep latency reasonable
    const CHUNK = 8;
    for (let i = 0; i < targets.length; i += CHUNK) {
      if (!this.active) return;
      const chunk = targets.slice(i, i + CHUNK).filter((e) => e.wrapper?.isConnected);
      if (chunk.length === 0) continue;
      try {
        const res = await sendToBackground('refineBatch', {
          originals: chunk.map((e) => e.paragraph.source),
          drafts: chunk.map((e) => e.translated ?? ''),
          from: cfg.sourceLang,
          to: cfg.targetLang,
          expertId: cfg.expertId,
          context: this.pageContext,
        });
        chunk.forEach((entry, j) => {
          const refined = res.results[j];
          if (refined && this.active) this.renderer.applyRefined(entry, refined);
        });
      } catch {
        // refine failures are silent: the draft translation is already shown
      }
    }
  }

  /** Restore the page to its original state. */
  restore(): void {
    this.active = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.io?.disconnect();
    this.io = null;
    this.watcher?.disconnect();
    this.watcher = null;
    this.unsubscribeConfig?.();
    this.unsubscribeConfig = null;
    for (const entry of this.entries) this.renderer.restore(entry);
    this.entries = [];
    this.entriesByContainer.clear();
    this.visibleQueue = [];
    this.queued.clear();
    this.seenAnchors = new WeakSet();
    this.pageContext = undefined;
    this.contextPromise = null;
  }

  async toggle(): Promise<boolean> {
    if (this.active) {
      this.restore();
      return false;
    }
    await this.start();
    return true;
  }
}
