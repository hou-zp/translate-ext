/**
 * Watches the DOM (and any discovered shadow roots) for added/changed content
 * and reports elements that may contain fresh translatable paragraphs.
 * Covers infinite scroll, SPA route changes and lazily-rendered widgets.
 */
export class DynamicWatcher {
  private mo: MutationObserver;
  private observedRoots = new Set<Node>();
  private pendingRoots = new Set<Element>();
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private onNewContent: (roots: Element[]) => void) {
    this.mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            if (el.closest('.txe-t, .txe-manga-box') || el.hasAttribute('data-txe-overlay'))
              continue;
            if (el.classList?.contains('txe-loading') || el.classList?.contains('txe-error')) continue;
            this.pendingRoots.add(el);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            const parent = node.parentElement;
            if (!parent.closest('.txe-t, .txe-manga-box')) {
              this.pendingRoots.add(parent);
            }
          }
        }
      }
      if (this.pendingRoots.size > 0) this.scheduleFlush();
    });
  }

  observe(root: Node): void {
    if (this.observedRoots.has(root)) return;
    this.observedRoots.add(root);
    this.mo.observe(root, { childList: true, subtree: true, characterData: false });
  }

  disconnect(): void {
    this.mo.disconnect();
    this.observedRoots.clear();
    this.pendingRoots.clear();
    if (this.flushTimer) clearTimeout(this.flushTimer);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      const roots = [...this.pendingRoots].filter((el) => el.isConnected);
      this.pendingRoots.clear();
      if (roots.length > 0) this.onNewContent(this.dedupe(roots));
    }, 400);
  }

  /** Drop roots that are contained by another pending root. */
  private dedupe(roots: Element[]): Element[] {
    return roots.filter((el) => !roots.some((other) => other !== el && other.contains(el)));
  }
}
