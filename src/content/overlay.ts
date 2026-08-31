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
:host {
  all: initial;
  --txe-bg: #ffffff;
  --txe-bg-2: #f4f6fa;
  --txe-text: #10192b;
  --txe-text-2: #55617a;
  --txe-line: rgba(16, 25, 43, 0.12);
  --txe-brand: #3b82f6;
  --txe-brand-strong: #2563eb;
  --txe-danger: #dc2626;
  --txe-success: #10b981;
}
@media (prefers-color-scheme: dark) {
  :host {
    --txe-bg: #161e30;
    --txe-bg-2: #1d2740;
    --txe-text: #e8edf6;
    --txe-text-2: #a3aec5;
    --txe-line: rgba(255, 255, 255, 0.14);
  }
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
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top-color: var(--txe-brand);
  border-radius: 50%;
  animation: txe-spin 0.8s linear infinite;
}

/* ---- selection bubble ---- */
.txe-sel-trigger {
  position: fixed;
  z-index: 2147483646;
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--txe-brand);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font: 500 13px/1 ${FONT_STACK};
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4);
  user-select: none;
  animation: txe-pop 0.15s cubic-bezier(0.22, 1, 0.36, 1);
  transition: transform 0.15s ease, background 0.15s ease;
}
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
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
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
.txe-sel-lang { opacity: 0.75; font-size: 11px; margin-left: 6px; }
.txe-sel-close {
  cursor: pointer; padding: 2px 6px; border-radius: 6px;
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
  border: 1px solid var(--txe-line); border-radius: 8px;
  padding: 3px 10px; cursor: pointer; background: transparent;
  transition: background 0.15s ease, color 0.15s ease;
}
.txe-sel-btn:hover { background: var(--txe-bg-2); color: var(--txe-text); }
.txe-sel-btn:disabled { opacity: 0.6; cursor: default; }

/* ---- float ball ---- */
.txe-ball {
  position: fixed;
  right: 10px;
  z-index: 2147483645;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--txe-bg);
  border: 1px solid var(--txe-line);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.18);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  color: var(--txe-brand);
  font: 600 18px/1 ${FONT_STACK};
  opacity: 0.6;
  transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}
.txe-ball:hover {
  opacity: 1;
  transform: scale(1.08);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
}
.txe-ball.txe-dragging { opacity: 0.8; transform: scale(1.05); }
.txe-ball-frame {
  position: fixed;
  right: 58px;
  z-index: 2147483645;
  width: 372px; height: 544px;
  border-radius: 16px;
  overflow: hidden;
  background: var(--txe-bg);
  border: 1px solid var(--txe-line);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
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
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
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
