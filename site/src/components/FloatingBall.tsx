import { useEffect, useRef, useState } from "react";
import { TARGETS } from "../data/content";
import { useSettings, type DisplayMode } from "../state/settings";
import {
  IconBall,
  IconBilingual,
  IconClose,
  IconGear,
  IconHover,
  IconInput,
  IconPanelRight,
  IconSelect,
  Logo,
} from "./Icons";

const POS_CLASS: Record<string, string> = {
  rm: "right-4 top-1/2 -translate-y-1/2",
  rb: "right-4 bottom-6",
  lm: "left-4 top-1/2 -translate-y-1/2",
  lb: "left-4 bottom-6",
};

export default function FloatingBall({
  quickOpen,
  setQuickOpen,
  onAction,
  translated,
  mode,
  setMode,
}: {
  quickOpen: boolean;
  setQuickOpen: (v: boolean) => void;
  onAction: (a: "translate" | "settings" | "sidebar" | "hide") => void;
  translated: boolean;
  mode: DisplayMode;
  setMode: (m: DisplayMode) => void;
}) {
  const { s, set } = useSettings();
  const b = s.ball;
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!b.enabled) setQuickOpen(false);
  }, [b.enabled, setQuickOpen]);
  useEffect(() => {
    setDrag(null);
  }, [b.pos]);

  if (!b.enabled) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!b.drag) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { px: e.clientX, py: e.clientY, ox: drag?.x ?? 0, oy: drag?.y ?? 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const st = startRef.current;
    const wr = wrapRef.current?.getBoundingClientRect();
    if (!st || !wr) return;
    const dx = e.clientX - st.px;
    const dy = e.clientY - st.py;
    if (Math.abs(dx) + Math.abs(dy) > 4) st.moved = true;
    if (!st.moved) return;
    const nx = Math.max(-wr.width / 2 + 8, Math.min(wr.width / 2 - b.size - 8, st.ox + dx));
    const ny = Math.max(-wr.height / 2 + 8, Math.min(wr.height / 2 - b.size - 8, st.oy + dy));
    setDrag({ x: nx, y: ny });
  };
  const onPointerUp = () => {
    const st = startRef.current;
    startRef.current = null;
    if (!st) return;
    if (st.moved) return;
    if (b.click === "translate") onAction("translate");
    else setQuickOpen(!quickOpen);
  };

  const baseTf = b.pos === "rm" || b.pos === "lm" ? " translateY(-50%)" : "";
  const stylePos: React.CSSProperties = drag
    ? { transform: `translate(${drag.x}px, ${drag.y}px)${baseTf}`, opacity: b.opacity / 100 }
    : { opacity: b.opacity / 100 };

  const rows: { icon: React.ReactNode; label: string; state?: string; on: () => void; active?: boolean }[] = [
    {
      icon: <IconBilingual />,
      label: translated ? "收起本页译文" : "翻译本页 · 双语对照",
      state: translated ? "ON" : "OFF",
      active: translated,
      on: () => onAction("translate"),
    },
    {
      icon: <IconBilingual className="h-4 w-4 rotate-90" />,
      label: "显示模式",
      state: mode === "bilingual" ? "对照" : mode === "only" ? "仅译文" : "原文",
      on: () => setMode(mode === "bilingual" ? "only" : mode === "only" ? "source" : "bilingual"),
    },
    {
      icon: <IconInput />,
      label: "输入框翻译",
      state: s.input.enabled ? "ON" : "OFF",
      active: s.input.enabled,
      on: () => set("input", { enabled: !s.input.enabled }),
    },
    {
      icon: <IconHover />,
      label: "悬停试译",
      state: s.hover.enabled ? "ON" : "OFF",
      active: s.hover.enabled,
      on: () => set("hover", { enabled: !s.hover.enabled }),
    },
    {
      icon: <IconSelect />,
      label: "划词浮译",
      state: s.select.enabled ? "ON" : "OFF",
      active: s.select.enabled,
      on: () => set("select", { enabled: !s.select.enabled }),
    },
    { icon: <IconPanelRight />, label: "打开侧边栏", on: () => onAction("sidebar") },
    { icon: <IconGear />, label: "完整设置页", on: () => onAction("settings") },
    { icon: <IconClose />, label: "隐藏悬浮球", on: () => onAction("hide") },
  ];

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 z-20">
      {/* ball */}
      <div
        className={`pointer-events-auto absolute ${POS_CLASS[b.pos]} transition-[opacity] ${drag ? "" : "transition-transform"}`}
        style={stylePos}
      >
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          title={`悬浮球 · 点击${b.click === "panel" ? "打开快捷面板" : "翻译本页"}${b.drag ? " · 可拖拽" : ""}`}
          className="group relative block rounded-full border border-[#d5482f]/50 bg-[#141920]/95 shadow-[0_10px_28px_-8px_rgba(0,0,0,0.7)] transition-transform hover:scale-105 active:scale-95"
          style={{ width: b.size, height: b.size, cursor: b.drag ? "grab" : "pointer" }}
        >
          <span className="absolute inset-0 rounded-full border border-[#d5482f]/30 opacity-70 [animation:pulseDot_2.6s_ease-in-out_infinite]" />
          <Logo className="absolute inset-0 m-auto h-[55%] w-[55%] text-bone transition-transform duration-300 group-hover:rotate-6" />
          {translated && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-[#141920] bg-[#57a79b]" />
          )}
        </button>

        {/* quick panel */}
        {quickOpen && (
          <div
            className={`pop-in absolute z-30 w-[236px] rounded-lg border border-white/10 bg-[#141920]/[0.98] p-2 shadow-[0_22px_50px_-14px_rgba(0,0,0,0.85)] ${
              b.pos.startsWith("r") ? "right-[calc(100%+10px)]" : "left-[calc(100%+10px)]"
            } ${b.pos === "rm" || b.pos === "lm" ? "top-1/2 -translate-y-1/2" : "bottom-0"}`}
            style={{ transformOrigin: b.pos.startsWith("r") ? "right center" : "left center" }}
          >
            <div className="mb-1.5 flex items-center gap-2 px-1.5 pt-1">
              <IconBall className="h-4 w-4 text-[#ef6a4c]" />
              <p className="font-display text-[12.5px] font-bold text-bone">快捷面板</p>
              <select
                value={s.basic.target}
                onChange={(e) => set("basic", { target: e.target.value as typeof s.basic.target })}
                className="ml-auto rounded border border-white/10 bg-[#1a2028] px-1 py-0.5 font-mono text-[9.5px] text-bone-dim outline-none"
                title="目标语言"
              >
                {TARGETS.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-0.5">
              {rows.map((r) => (
                <button
                  key={r.label}
                  onClick={r.on}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12px] text-bone-dim transition-colors hover:bg-white/5 hover:text-bone"
                >
                  <span className={r.active ? "text-[#57a79b]" : "text-mute"}>{r.icon}</span>
                  <span className="flex-1 truncate">{r.label}</span>
                  {r.state && (
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                        r.state === "OFF" ? "bg-white/5 text-ink-500" : "bg-[#2e7d74]/20 text-[#57a79b]"
                      }`}
                    >
                      {r.state}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-1.5 border-t border-white/5 px-1.5 pb-0.5 pt-1.5 font-mono text-[9px] text-ink-500">
              拖拽球体可移动 · 设置页「悬浮球」可改位置/大小
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
