import { isTranslatableText, looksLikeTarget } from '../core/langs';

/**
 * A translation unit: a run of consecutive inline/text nodes inside a container.
 * For a normal leaf block (e.g. <p>) the nodes are all of its children.
 */
export interface Paragraph {
  container: Element;
  nodes: Node[];
  /** Text with inline elements encoded as <t0>..</t0> markers */
  source: string;
  /** marker index -> original inline element (used to rebuild the translation DOM) */
  inlineMap: Element[];
  /** plain text without markers */
  plain: string;
}

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION',
  'BUTTON', 'CODE', 'PRE', 'KBD', 'SAMP', 'SVG', 'MATH', 'CANVAS', 'VIDEO', 'AUDIO',
  'IFRAME', 'OBJECT', 'EMBED', 'MAP', 'TRACK', 'IMG', 'PICTURE', 'SOURCE', 'HEAD',
  'META', 'LINK', 'TITLE', 'BASE', 'DIALOG',
]);

const INLINE_TAGS = new Set([
  'A', 'B', 'I', 'EM', 'STRONG', 'SPAN', 'SMALL', 'SUP', 'SUB', 'U', 'S', 'STRIKE',
  'ABBR', 'MARK', 'TIME', 'CITE', 'Q', 'VAR', 'FONT', 'BDI', 'BDO', 'DATA', 'DFN',
  'INS', 'DEL', 'RUBY', 'RT', 'RP', 'WBR', 'BR', 'LABEL', 'OUTPUT', 'TT', 'NOBR',
]);

function isOurNode(el: Element): boolean {
  return (
    el.classList?.contains('txe-t') ||
    el.classList?.contains('txe-orig-holder') ||
    el.classList?.contains('txe-loading') ||
    el.classList?.contains('txe-error') ||
    el.closest?.('.txe-t, .txe-sel-panel, .txe-sel-trigger, .txe-ball, .txe-ball-panel') != null
  );
}

function shouldSkipElement(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (isOurNode(el)) return true;
  if (el instanceof HTMLElement) {
    if (el.isContentEditable) return true;
    if (el.translate === false || el.getAttribute('translate') === 'no') return true;
    if (el.classList.contains('notranslate')) return true;
    if (el.hidden) return true;
    const ariaHidden = el.getAttribute('aria-hidden');
    if (ariaHidden === 'true') return true;
    // visually-clipped a11y text (sr-only / visually-hidden): translating it
    // leaks a visible translation into the layout, e.g. over form fields.
    // Note: display:none elements report 0x0 with a null offsetParent and are
    // intentionally NOT skipped, so hidden menus still translate when opened.
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w > 0 && w <= 2 && h > 0 && h <= 2 && el.offsetParent) return true;
  }
  return false;
}

function isInline(el: Element): boolean {
  return INLINE_TAGS.has(el.tagName);
}

/** Standalone UI controls that carry their own label (BUTTON is skipped entirely). */
const INTERACTIVE_TAGS = new Set(['A', 'LABEL', 'SUMMARY']);

/** Serialize a run of inline nodes to marker text, collecting the inline element map. */
function serializeNodes(nodes: Node[], inlineMap: Element[]): { source: string; plain: string } {
  let source = '';
  let plain = '';
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.nodeValue ?? '';
      source += v;
      plain += v;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    if (shouldSkipElement(el)) return;
    if (el.tagName === 'BR' || el.tagName === 'WBR') {
      source += ' ';
      plain += ' ';
      return;
    }
    const idx = inlineMap.length;
    inlineMap.push(el);
    source += `<t${idx}>`;
    el.childNodes.forEach(visit);
    source += `</t${idx}>`;
    // plain text keeps flowing without markers
  };
  for (const n of nodes) visit(n);
  return { source: source.replace(/\s+/g, ' ').trim(), plain: plain.replace(/\s+/g, ' ').trim() };
}

function makeParagraph(container: Element, nodes: Node[], targetLang: string): Paragraph | null {
  const inlineMap: Element[] = [];
  const { source, plain } = serializeNodes(nodes, inlineMap);
  if (!isTranslatableText(plain)) return null;
  if (looksLikeTarget(plain, targetLang)) return null;
  if (plain.length > 8000) return null; // absurdly long single block, skip
  return { container, nodes, source, inlineMap, plain };
}

/**
 * Recursively collect translation paragraphs beneath `root`.
 * Descends into open shadow roots. Reports each discovered shadow root
 * through `onShadowRoot` so observers can be attached.
 */
export function collectParagraphs(
  root: ParentNode,
  targetLang: string,
  translatedContainers: WeakSet<Element>,
  onShadowRoot?: (sr: ShadowRoot) => void,
  excludeSelector?: string,
): Paragraph[] {
  const out: Paragraph[] = [];

  const isExcluded = (el: Element): boolean => {
    if (!excludeSelector) return false;
    try {
      return el.matches(excludeSelector);
    } catch {
      return false; // invalid selector in the site rule
    }
  };

  const visitElement = (el: Element) => {
    if (shouldSkipElement(el) || isExcluded(el)) return;
    const sr = (el as HTMLElement).shadowRoot;
    if (sr) {
      onShadowRoot?.(sr);
      visitContainer(sr);
    }

    // Split children into runs of inline/text nodes vs block elements.
    const children = Array.from(el.childNodes);
    let run: Node[] = [];
    let runHasText = false;
    const emitRun = () => {
      // A run made purely of standalone links/controls (nav bars, button
      // rows) must be split per element: translating them as one unit would
      // merge unrelated labels and clone the styled controls next to the
      // originals. Links inside prose still have bare text around them and
      // stay part of their sentence.
      const bareText = run.some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.nodeValue ?? '').trim().length > 0,
      );
      // Only elements that actually carry text matter for the decision;
      // empty wrappers (icon spans, input wrappers) are ignored.
      const textEls = run.filter(
        (n): n is Element =>
          n.nodeType === Node.ELEMENT_NODE && ((n.textContent ?? '').trim().length > 0),
      );
      if (!bareText && textEls.length > 0 && textEls.every((e) => INTERACTIVE_TAGS.has(e.tagName))) {
        for (const item of textEls) {
          if (translatedContainers.has(item)) continue;
          const p = makeParagraph(item, Array.from(item.childNodes), targetLang);
          if (p) out.push(p);
        }
        return;
      }
      const p = makeParagraph(el, run, targetLang);
      if (p) out.push(p);
    };
    const flushRun = () => {
      if (run.length > 0 && runHasText && !translatedContainers.has(el)) emitRun();
      run = [];
      runHasText = false;
    };

    let hasBlockChild = false;
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const c = child as Element;
        if (shouldSkipElement(c)) {
          // treat as run boundary but keep going
          if (!isInline(c)) {
            hasBlockChild = true;
            flushRun();
          }
          continue;
        }
        if (isInline(c)) {
          run.push(c);
          if ((c.textContent ?? '').trim().length > 0) runHasText = true;
        } else {
          hasBlockChild = true;
          flushRun();
          visitElement(c);
        }
      } else if (child.nodeType === Node.TEXT_NODE) {
        run.push(child);
        if ((child.nodeValue ?? '').trim().length > 0) runHasText = true;
      }
    }

    if (hasBlockChild) {
      flushRun();
    } else {
      // leaf block: the whole element is one paragraph
      if (!translatedContainers.has(el) && runHasText) emitRun();
    }
  };

  const visitContainer = (container: ParentNode) => {
    for (const child of Array.from(container.children)) visitElement(child);
  };

  if (root instanceof Element) visitElement(root);
  else visitContainer(root);
  return out;
}

/**
 * Rebuild a DOM fragment from translated marker text, cloning the original
 * inline elements (so links keep their href, bold stays bold...).
 * Falls back to plain text when the markers come back mangled.
 */
export function restoreInline(translated: string, inlineMap: Element[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const tokenRe = /<\s*(\/?)\s*t\s*(\d+)\s*>/gi;
  const stack: (DocumentFragment | Element)[] = [frag];
  let lastIndex = 0;
  let balanced = true;

  const top = () => stack[stack.length - 1]!;

  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(translated)) !== null) {
    const textBefore = translated.slice(lastIndex, m.index);
    if (textBefore) top().appendChild(document.createTextNode(textBefore));
    lastIndex = tokenRe.lastIndex;
    const closing = m[1] === '/';
    const idx = Number(m[2] ?? -1);
    if (!closing) {
      const original = inlineMap[idx];
      if (!original) {
        balanced = false;
        continue;
      }
      const clone = original.cloneNode(false) as Element;
      clone.textContent = '';
      top().appendChild(clone);
      stack.push(clone);
    } else {
      if (stack.length > 1) stack.pop();
      else balanced = false;
    }
  }
  const rest = translated.slice(lastIndex);
  if (rest) top().appendChild(document.createTextNode(rest));

  if (!balanced && stack.length !== 1) {
    // hopeless mismatch: plain-text fallback
    const plain = document.createDocumentFragment();
    plain.appendChild(document.createTextNode(stripMarkers(translated)));
    return plain;
  }
  return frag;
}

export function stripMarkers(text: string): string {
  return text.replace(/<\s*\/?\s*t\s*\d+\s*>/gi, '');
}
