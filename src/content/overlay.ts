/**
 * Shared Shadow DOM host for all injected chrome (selection bubble, float
 * ball, image panel, progress pill). Shadow isolation keeps site CSS from
 * leaking into our UI and vice versa. Inline translations (.txe-t) stay in
 * the page because they must participate in page layout.
 */

const HOST_ATTR = 'data-txe-overlay';

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";

const CHROME_CSS = `
/* ink-and-cinnabar theme, matching the extension pages */
:host {
  all: initial;
  --txe-bg: #141920;
  --txe-bg-2: #1a2028;
  --txe-text: #e9e4d8;
  --txe-text-2: #b6b1a6;
  --txe-text-3: #8c95a0;
  --txe-line: rgba(233, 228, 216, 0.12);
  --txe-line-strong: rgba(233, 228, 216, 0.18);
  --txe-brand: #d5482f;
  --txe-brand-strong: #ef6a4c;
  --txe-danger: #ef6a4c;
  --txe-success: #57a79b;
}
*, *::before, *::after { box-sizing: border-box; }
button { font: inherit; }

@keyframes txe-pop {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes txe-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes txe-spin { to { transform: rotate(360deg); } }

/* ---- loading spinner (panels) ---- */
.txe-loading {
  display: inline-block;
  width: 0.85em; height: 0.85em;
  vertical-align: -0.08em;
  border: 2px solid rgba(213, 72, 47, 0.3);
  border-top-color: var(--txe-brand);
  border-radius: 50%;
  animation: txe-spin 0.8s linear infinite;
}

/* ---- selection bubble ---- */
.txe-sel-trigger {
  position: fixed;
  z-index: 2147483646;
  width: 30px; height: 30px;
  border-radius: 50%;
  background: var(--txe-brand);
  border: 1px solid rgba(233, 228, 216, 0.25);
  color: #f5f1e8;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(213, 72, 47, 0.45);
  user-select: none;
  animation: txe-pop 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  transition: transform 0.15s ease, background 0.15s ease;
}
.txe-sel-trigger svg { width: 18px; height: 18px; }
.txe-sel-trigger:hover {
  transform: scale(1.1);
  background: var(--txe-brand-strong);
}
.txe-sel-panel {
  position: fixed;
  z-index: 2147483646;
  min-width: 260px; max-width: 380px;
  background: var(--txe-bg);
  color: var(--txe-text);
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--txe-line);
  font: 400 14px/1.6 ${FONT_STACK};
  overflow: hidden;
  animation: txe-pop 0.15s cubic-bezier(0.22, 1, 0.36, 1);
}
.txe-sel-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px;
  padding: 7px 11px;
  background: var(--txe-bg-2);
  border-bottom: 1px solid var(--txe-line);
  font-size: 12px; color: var(--txe-text-2);
}
.txe-sel-lang { opacity: 0.75; font-size: 11px; margin-left: 6px; font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
.txe-sel-close {
  cursor: pointer; padding: 2px 6px; border-radius: 4px;
  transition: background 0.15s ease;
}
.txe-sel-close:hover { background: var(--txe-line); }
.txe-sel-body {
  padding: 10px 12px;
  max-height: 260px; overflow: auto;
  white-space: pre-wrap; word-break: break-word;
}
.txe-sel-hint { margin-top: 6px; font-size: 11px; opacity: 0.65; }
.txe-sel-foot {
  display: flex; gap: 6px;
  padding: 7px 11px;
  border-top: 1px solid var(--txe-line);
}
.txe-sel-btn {
  font-size: 12px; color: var(--txe-text-2);
  border: 1px solid var(--txe-line); border-radius: 6px;
  padding: 3px 10px; cursor: pointer; background: transparent;
  transition: background 0.15s ease, color 0.15s ease;
}
.txe-sel-btn:hover { background: var(--txe-bg-2); color: var(--txe-text); }
.txe-sel-btn:disabled { opacity: 0.6; cursor: default; }

/* ---- float ball ---- */
@keyframes txe-pulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50% { opacity: 0.25; transform: scale(1.12); }
}
.txe-ball {
  position: fixed;
  right: 10px;
  z-index: 2147483645;
  width: 44px; height: 44px;
  border-radius: 50%;
  background: #141920;
  border: 1px solid rgba(213, 72, 47, 0.55);
  box-shadow: 0 10px 28px -8px rgba(0, 0, 0, 0.7);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  opacity: 0.92;
  transition: opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease;
  user-select: none;
  animation: txe-pop 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.txe-ball::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 50%;
  border: 1px solid rgba(213, 72, 47, 0.35);
  animation: txe-pulse 2.6s ease-in-out infinite;
  pointer-events: none;
}
.txe-ball svg { width: 62%; height: 62%; transition: transform 0.2s ease; }
.txe-ball:hover {
  opacity: 1;
  transform: scale(1.06);
  border-color: rgba(213, 72, 47, 0.9);
}
.txe-ball:hover svg { transform: rotate(6deg); }
.txe-ball.txe-dragging { opacity: 0.8; transform: scale(1.05); }
.txe-ball-dot {
  position: absolute;
  top: 1px; right: 1px;
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--txe-success);
  border: 2px solid #141920;
  display: none;
}
.txe-ball.txe-active .txe-ball-dot { display: block; }
.txe-ball-frame {
  position: fixed;
  right: 62px;
  z-index: 2147483645;
  width: 372px; height: 544px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--txe-bg);
  border: 1px solid var(--txe-line-strong);
  box-shadow: 0 28px 60px -18px rgba(0, 0, 0, 0.85);
  animation: txe-rise 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}
.txe-ball-frame iframe {
  display: block;
  width: 100%; height: 100%;
  border: none;
  background: var(--txe-bg);
}

/* ---- page translation progress pill ---- */
.txe-progress {
  position: fixed;
  right: 16px; bottom: 16px;
  z-index: 2147483645;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--txe-bg);
  color: var(--txe-text-2);
  border: 1px solid var(--txe-line);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  font: 500 12px/1 ${FONT_STACK};
  animation: txe-rise 0.2s cubic-bezier(0.22, 1, 0.36, 1);
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.txe-progress-num { color: var(--txe-text); font-variant-numeric: tabular-nums; }
.txe-progress-done { color: var(--txe-success); }
.txe-progress-cancel {
  cursor: pointer; padding: 2px 5px; border-radius: 6px;
  color: var(--txe-text-2);
  transition: background 0.15s ease, color 0.15s ease;
}
.txe-progress-cancel:hover { background: var(--txe-bg-2); color: var(--txe-text); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;

let hostEl: HTMLElement | null = null;
let root: ShadowRoot | null = null;

/** The shared shadow root all injected chrome renders into. */
export function overlayRoot(): ShadowRoot {
  if (root && hostEl?.isConnected) return root;
  hostEl = document.createElement('div');
  hostEl.setAttribute(HOST_ATTR, '');
  hostEl.style.all = 'initial';
  const shadow = hostEl.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = CHROME_CSS;
  shadow.appendChild(style);
  document.documentElement.appendChild(hostEl);
  root = shadow;
  return shadow;
}

/** True when the event originated inside overlay elements with any of these classes. */
export function pathHasClass(ev: Event, ...classes: string[]): boolean {
  return ev
    .composedPath()
    .some((n) => n instanceof Element && classes.some((c) => n.classList.contains(c)));
}

/** True when `el` is the overlay shadow host (retargeted event target). */
export function isOverlayHost(el: unknown): boolean {
  return el instanceof Element && el.hasAttribute(HOST_ATTR);
}

/** Fade an overlay element out, then remove it. */
export function fadeOutRemove(el: HTMLElement, duration = 140): void {
  el.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
  el.style.opacity = '0';
  el.style.transform = 'scale(0.97)';
  setTimeout(() => el.remove(), duration + 30);
}
