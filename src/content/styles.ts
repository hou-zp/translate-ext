const CSS = `
.txe-t {
  display: block;
  margin-top: 0.35em;
  unicode-bidi: isolate;
}
.txe-t.txe-inline { display: inline; margin: 0 0 0 0.4em; }
.txe-style-plain {}
.txe-style-underline { border-bottom: 1px solid rgba(59, 130, 246, 0.55); padding-bottom: 1px; width: fit-content; max-width: 100%; }
.txe-style-dashed { border-bottom: 1px dashed rgba(59, 130, 246, 0.7); padding-bottom: 1px; width: fit-content; max-width: 100%; }
.txe-style-quote { border-left: 3px solid rgba(59, 130, 246, 0.6); padding-left: 8px; opacity: 0.92; }
.txe-style-highlight { background: rgba(59, 130, 246, 0.10); border-radius: 3px; padding: 0 3px; width: fit-content; max-width: 100%; }

.txe-loading {
  display: inline-block;
  width: 0.85em; height: 0.85em;
  margin-left: 0.4em;
  vertical-align: -0.08em;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top-color: rgba(59, 130, 246, 0.95);
  border-radius: 50%;
  animation: txe-spin 0.8s linear infinite;
}
@keyframes txe-spin { to { transform: rotate(360deg); } }

.txe-error {
  display: inline-block;
  margin-left: 0.4em;
  color: #dc2626;
  font-size: 0.85em;
  cursor: pointer;
  border-bottom: 1px dotted #dc2626;
}
.txe-orig-holder { display: none !important; }

/* ---- selection bubble ---- */
.txe-sel-trigger {
  position: fixed;
  z-index: 2147483646;
  width: 26px; height: 26px;
  border-radius: 50%;
  background: #3b82f6;
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  user-select: none;
}
.txe-sel-panel {
  position: fixed;
  z-index: 2147483646;
  min-width: 260px; max-width: 380px;
  background: #fff;
  color: #111827;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.18);
  border: 1px solid rgba(0,0,0,0.08);
  font-size: 14px;
  line-height: 1.6;
  overflow: hidden;
}
.txe-sel-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: #f8fafc;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  font-size: 12px; color: #64748b;
}
.txe-sel-close { cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.txe-sel-close:hover { background: rgba(0,0,0,0.06); }
.txe-sel-body { padding: 10px 12px; max-height: 260px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
.txe-sel-foot { display: flex; gap: 6px; padding: 6px 10px; border-top: 1px solid rgba(0,0,0,0.06); }
.txe-sel-btn {
  font-size: 12px; color: #334155;
  border: 1px solid rgba(0,0,0,0.12); border-radius: 6px;
  padding: 2px 10px; cursor: pointer; background: #fff;
}
.txe-sel-btn:hover { background: #f1f5f9; }

/* ---- float ball ---- */
.txe-ball {
  position: fixed;
  right: 10px;
  z-index: 2147483645;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.1);
  box-shadow: 0 3px 12px rgba(0,0,0,0.18);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  font-size: 19px;
  opacity: 0.6;
  transition: opacity 0.15s ease;
  user-select: none;
}
.txe-ball:hover { opacity: 1; }
.txe-ball-panel {
  position: fixed;
  right: 58px;
  z-index: 2147483645;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.18);
  border: 1px solid rgba(0,0,0,0.08);
  padding: 6px;
  display: flex; flex-direction: column; gap: 2px;
  min-width: 140px;
}
.txe-ball-item {
  font-size: 13px; color: #1f2937;
  padding: 7px 10px; border-radius: 6px; cursor: pointer;
  white-space: nowrap;
}
.txe-ball-item:hover { background: #f1f5f9; }
.txe-ball-frame {
  padding: 0;
  width: 372px;
  height: 544px;
  overflow: hidden;
  border-radius: 14px;
}
.txe-ball-frame iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

@media (prefers-color-scheme: dark) {
  .txe-sel-panel, .txe-ball-panel { background: #1f2937; color: #e5e7eb; border-color: rgba(255,255,255,0.1); }
  .txe-sel-head { background: #111827; color: #9ca3af; border-color: rgba(255,255,255,0.08); }
  .txe-sel-btn { background: #1f2937; color: #d1d5db; border-color: rgba(255,255,255,0.15); }
  .txe-sel-btn:hover, .txe-ball-item:hover, .txe-sel-close:hover { background: rgba(255,255,255,0.08); }
  .txe-sel-foot { border-color: rgba(255,255,255,0.08); }
  .txe-ball { background: #1f2937; border-color: rgba(255,255,255,0.15); }
  .txe-ball-item { color: #e5e7eb; }
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
