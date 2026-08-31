import type { DisplayMode, TranslationStyle } from '../core/config';
import { t } from '../core/i18n';
import { restoreInline, stripMarkers, type Paragraph } from './walker';

export type EntryState = 'pending' | 'loading' | 'done' | 'error';

export interface ParagraphEntry {
  paragraph: Paragraph;
  state: EntryState;
  /** inserted translation element (bilingual) or replacement wrapper (replace) */
  wrapper: Element | null;
  /** hidden holder keeping original nodes in replace mode */
  origHolder: Element | null;
  loadingEl: Element | null;
  errorEl: Element | null;
  translated: string | null;
  refined: boolean;
}

export function createEntry(paragraph: Paragraph): ParagraphEntry {
  return {
    paragraph,
    state: 'pending',
    wrapper: null,
    origHolder: null,
    loadingEl: null,
    errorEl: null,
    translated: null,
    refined: false,
  };
}

function lastAnchor(p: Paragraph): Node {
  // paragraphs are only constructed from non-empty node runs
  return p.nodes[p.nodes.length - 1]!;
}

function insertAfterNodes(p: Paragraph, el: Element): void {
  const anchor = lastAnchor(p);
  if (anchor.parentNode === p.container) {
    p.container.insertBefore(el, anchor.nextSibling);
  } else {
    p.container.appendChild(el);
  }
}

export class ParagraphRenderer {
  constructor(
    private getMode: () => DisplayMode,
    private getStyle: () => TranslationStyle,
  ) {}

  showLoading(entry: ParagraphEntry): void {
    if (entry.loadingEl?.isConnected) return;
    this.clearError(entry);
    const spin = document.createElement('span');
    spin.className = 'txe-loading';
    insertAfterNodes(entry.paragraph, spin);
    entry.loadingEl = spin;
    entry.state = 'loading';
  }

  clearLoading(entry: ParagraphEntry): void {
    entry.loadingEl?.remove();
    entry.loadingEl = null;
  }

  showError(entry: ParagraphEntry, message: string, onRetry: () => void): void {
    this.clearLoading(entry);
    this.clearError(entry);
    const err = document.createElement('span');
    err.className = 'txe-error';
    err.textContent = `${t('翻译失败')} · ${t('点击重试')}`;
    err.title = message;
    err.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      err.remove();
      onRetry();
    });
    insertAfterNodes(entry.paragraph, err);
    entry.errorEl = err;
    entry.state = 'error';
  }

  clearError(entry: ParagraphEntry): void {
    entry.errorEl?.remove();
    entry.errorEl = null;
  }

  render(entry: ParagraphEntry, translated: string): void {
    this.clearLoading(entry);
    this.clearError(entry);
    entry.translated = translated;

    if (this.getMode() === 'replace') {
      this.renderReplace(entry, restoreInline(translated, entry.paragraph.inlineMap));
    } else {
      this.renderBilingual(entry, translated);
    }
    entry.state = 'done';
  }

  /** Update an already-rendered entry with a refined translation. */
  applyRefined(entry: ParagraphEntry, refined: string): void {
    if (!entry.wrapper?.isConnected) return;
    if (entry.wrapper.hasAttribute('data-txe-plain')) {
      // in-element label rendering: plain text only, no badge/clones
      entry.wrapper.textContent = ` ${stripMarkers(refined)}`;
    } else {
      const frag = restoreInline(refined, entry.paragraph.inlineMap);
      entry.wrapper.textContent = '';
      entry.wrapper.appendChild(frag);
    }
    entry.translated = refined;
    entry.refined = true;
  }

  /**
   * A run consisting of exactly one interactive/short inline element
   * (nav link, button, label...). Cloning it as a sibling would duplicate
   * a styled control and wreck flex layouts, so the translation goes
   * INSIDE the element as plain text: "Sign up 注册".
   */
  private singleInlineHost(p: Paragraph): Element | null {
    if (p.nodes.length !== 1) return null;
    const node = p.nodes[0];
    if (!(node instanceof Element)) return null;
    const interactive = /^(A|BUTTON|LABEL|SUMMARY|TH|TD)$/.test(node.tagName);
    if (interactive || p.plain.length <= 20) return node;
    return null;
  }

  private renderBilingual(entry: ParagraphEntry, translated: string): void {
    const p = entry.paragraph;

    const host = this.singleInlineHost(p);
    if (host) {
      const el = document.createElement('font');
      el.className = 'txe-t txe-inline txe-style-plain';
      el.setAttribute('data-txe-plain', '');
      el.textContent = ` ${stripMarkers(translated)}`;
      host.appendChild(el);
      entry.wrapper = el;
      return;
    }

    const frag = restoreInline(translated, p.inlineMap);
    const el = document.createElement('font');
    el.className = `txe-t txe-style-${this.getStyle()}`;
    // Inside a link/label the translation must never break to a new line;
    // short labels / table cells also read better inline than as a block.
    const insideControl = /^(A|LABEL|SUMMARY)$/.test(p.container.tagName);
    if (insideControl || (p.plain.length <= 20 && !/^(P|H[1-6]|LI|BLOCKQUOTE|DD|DT|FIGCAPTION)$/.test(p.container.tagName))) {
      el.classList.add('txe-inline');
    }
    el.appendChild(frag);
    insertAfterNodes(p, el);
    entry.wrapper = el;
  }

  private renderReplace(entry: ParagraphEntry, frag: DocumentFragment): void {
    const p = entry.paragraph;
    // hide originals in place, keep them for restore
    const holder = document.createElement('span');
    holder.className = 'txe-orig-holder';
    const anchor = document.createComment('txe-anchor');
    p.container.insertBefore(anchor, p.nodes[0] ?? null);
    for (const n of p.nodes) {
      if (n.parentNode === p.container) holder.appendChild(n);
    }
    const wrapper = document.createElement('font');
    wrapper.className = 'txe-t txe-inline txe-style-plain';
    wrapper.style.margin = '0';
    wrapper.appendChild(frag);
    p.container.insertBefore(wrapper, anchor);
    p.container.insertBefore(holder, anchor);
    anchor.remove();
    entry.wrapper = wrapper;
    entry.origHolder = holder;
  }

  /** Undo everything this entry added/changed in the DOM. */
  restore(entry: ParagraphEntry): void {
    this.clearLoading(entry);
    this.clearError(entry);
    if (entry.origHolder) {
      const holder = entry.origHolder;
      const parent = holder.parentNode;
      if (parent) {
        while (holder.firstChild) parent.insertBefore(holder.firstChild, holder);
        holder.remove();
      }
      entry.origHolder = null;
    }
    entry.wrapper?.remove();
    entry.wrapper = null;
    entry.state = 'pending';
    entry.translated = null;
    entry.refined = false;
  }
}

export function plainTranslation(entry: ParagraphEntry): string {
  return stripMarkers(entry.translated ?? '');
}
