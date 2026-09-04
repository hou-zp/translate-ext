/**
 * Page-level CSS: inline translation nodes, per-paragraph loading/error
 * indicators and input-translate feedback. These MUST live in the page
 * (not the overlay shadow root) because they style page elements and
 * participate in page layout. All injected chrome (bubbles, float ball,
 * progress pill) is styled inside the shadow root — see overlay.ts.
 */
import { styleDeclToCss, TRANSLATION_STYLES } from './style-defs';

const STYLE_RULES = Object.entries(TRANSLATION_STYLES)
  .map(([name, decl]) => `.txe-style-${name} { ${styleDeclToCss(decl)} }`)
  .join('\n');

const CSS = `
.txe-t {
  display: block;
  margin-top: 0.35em;
  unicode-bidi: isolate;
}
.txe-t.txe-inline { display: inline; margin: 0 0 0 0.4em; }
${STYLE_RULES}

.txe-loading {
  display: inline-block;
  width: 0.85em; height: 0.85em;
  margin-left: 0.4em;
  vertical-align: -0.08em;
  border: 2px solid rgba(213, 72, 47, 0.3);
  border-top-color: rgba(213, 72, 47, 0.95);
  border-radius: 50%;
  animation: txe-spin 0.8s linear infinite;
}
@keyframes txe-spin { to { transform: rotate(360deg); } }

.txe-error {
  display: inline-block;
  margin-left: 0.4em;
  color: #ef6a4c;
  font-size: 0.85em;
  cursor: pointer;
  border-bottom: 1px dotted #ef6a4c;
}
.txe-orig-holder { display: none !important; }

/* hover-translate: brief highlight on the paragraph being translated */
.txe-hover-hint {
  background: rgba(213, 72, 47, 0.08) !important;
  border-radius: 2px;
  transition: background 0.2s ease;
}

/* input-translate feedback */
.txe-input-busy {
  outline: 2px solid rgba(213, 72, 47, 0.55) !important;
  outline-offset: 1px;
  animation: txe-input-pulse 1s ease-in-out infinite;
}
@keyframes txe-input-pulse {
  50% { outline-color: rgba(213, 72, 47, 0.15); }
}
.txe-input-error {
  outline: 2px solid rgba(239, 106, 76, 0.7) !important;
  outline-offset: 1px;
  animation: txe-input-shake 0.4s ease;
}
@keyframes txe-input-shake {
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

@media (prefers-reduced-motion: reduce) {
  .txe-loading { animation-duration: 1.6s; }
  .txe-hover-hint { transition: none; }
  .txe-input-busy, .txe-input-error { animation: none; }
}
`;

let injected = false;

export function injectStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-txe', 'styles');
  style.textContent = CSS;
  (document.head ?? document.documentElement).appendChild(style);
}
