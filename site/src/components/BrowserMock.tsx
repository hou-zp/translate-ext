import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import articleImg from "../assets/article-ink.jpg";
import { ARTICLE, INPUT_SAMPLES, TARGETS, offlineTranslate } from "../data/content";
import { useInView, usePrefersReducedMotion } from "../hooks/useReveal";
import { copyText, translate, VIA_LABEL } from "../lib/translate";
import { applyTerms, matchHotkey, useSettings, type DisplayMode, type TransStyle } from "../state/settings";
import FloatingBall from "./FloatingBall";
import SettingsPage from "./SettingsPage";
import SidePanel, { type OutlineItem } from "./SidePanel";
import { IconBack, IconClose, IconCopy, IconGear, IconLock, IconPanelRight, IconPin, IconPlus, IconReload, Logo } from "./Icons";

type Entry = { st: "loading" | "done" | "error"; text?: string; via?: string; key?: string };
type Bubble = { top: number; left: number; text: string; st: "loading" | "done" | "error"; trans?: string; via?: string };
type Toast = { id: number; msg: string; tone: "ok" | "err" };

const COLOR_CLASS: Record<TransStyle["color"], string> = {
  jade: "text-[#2b6d64]",
  cinnabar: "text-[#b23f2a]",
  ink: "text-[#5d6169]",
  gold: "text-[#8a6a2f]",
};
const SWATCH: Record<TransStyle["color"], string> = { jade: "#2e7d74", cinnabar: "#d5482f", ink: "#5d6169", gold: "#b98a3e" };

let toastSeq = 0;

function Toggle({ on, setT, label }: { on: boolean; setT: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => setT(!on)}
      className="flex w-full items-center justify-between py-1 text-left text-[12px] text-bone-dim transition-colors hover:text-bone"
    >
      {label}
      <span className={`relative h-[16px] w-[30px] rounded-full transition-colors ${on ? "bg-[#2e7d74]" : "bg-ink-600"}`}>
        <span className={`absolute top-[2px] h-3 w-3 rounded-full bg-bone transition-all ${on ? "left-[15px]" : "left-[3px]"}`} />
      </span>
    </button>
  );
}

export default function BrowserMock({
  mode,
  setMode,
  style,
  setStyle,
}: {
  mode: DisplayMode;
  setMode: (m: DisplayMode) => void;
  style: TransStyle;
  setStyle: (s: TransStyle) => void;
}) {
  const { s, set, pushLog, bump } = useSettings();
  const reduced = usePrefersReducedMotion();
  const { ref: viewRef } = useInView<HTMLDivElement>(0.12);

  const [view, setView] = useState<"article" | "newtab" | "settings">("article");
  const [popupOpen, setPopupOpen] = useState(false);
  const [powered, setPowered] = useState(true);
  const [translated, setTranslated] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [ballHidden, setBallHidden] = useState(false);
  const [selIcon, setSelIcon] = useState<{ top: number; left: number; text: string } | null>(null);

  const [trans, setTrans] = useState<Record<string, Entry>>({});
  const [pinned, setPinned] = useState<Record<string, boolean>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [bubble, setBubble] = useState<Bubble | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [chars, setChars] = useState(0);

  const [comment, setComment] = useState("");
  const [commentOrig, setCommentOrig] = useState<string | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [ntInput, setNtInput] = useState("");
  const [ntBusy, setNtBusy] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLButtonElement | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const autoRef = useRef(false);
  const hoverTimer = useRef<number | null>(null);
  const pressed = useRef({ alt: false, ctrl: false });

  const target = s.basic.target;
  const route = s.services.route;
  const termsSig = s.terms.enabled ? JSON.stringify(s.terms.list) : "off";
  const routeKey = `${target}|${route}|${termsSig}`;
  const showTrans = powered && translated;
  const translatedRef = useRef(translated);
  translatedRef.current = translated;

  const toast = useCallback((msg: string, tone: Toast["tone"] = "ok") => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  /* ---------- modifier tracking for hover ---------- */
  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      pressed.current = { alt: e.altKey, ctrl: e.ctrlKey };
    };
    const up = (e: KeyboardEvent) => {
      pressed.current = { alt: e.altKey, ctrl: e.ctrlKey };
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ---------- resolve translations ---------- */
  const resolveBlock = useCallback(
    (id: string, en: string[], zh: string[], index: number) => {
      const useCorpus = route === "auto" && target === "zh-CN";
      const delay = reduced ? 0 : index * 85;
      if (useCorpus) {
        window.setTimeout(() => {
          const text = applyTerms(zh.join(""), s.terms);
          setTrans((t) => ({ ...t, [id]: { st: "done", text, via: "corpus", key: routeKey } }));
          setLatency(6 + Math.floor(Math.random() * 9));
          setChars((c) => c + text.length);
          bump(text.length, 0);
          if (s.adv.debug) pushLog(`resolve ${id} · corpus <1ms`, "ok");
        }, delay + 120);
      } else {
        const t0 = performance.now();
        window.setTimeout(() => {
          translate(en.join(" "), target, route)
            .then((r) => {
              const text = applyTerms(r.text, s.terms);
              const ms = Math.round(performance.now() - t0);
              setTrans((t) => ({ ...t, [id]: { st: "done", text, via: r.via, key: routeKey } }));
              setLatency(ms);
              setChars((c) => c + text.length);
              bump(text.length, 1);
              if (s.adv.debug) pushLog(`resolve ${id} · ${r.via} ${ms}ms`, "ok");
            })
            .catch(() => {
              setTrans((t) => ({ ...t, [id]: { st: "error", key: routeKey } }));
              pushLog(`resolve ${id} 失败 · 引擎不可达`, "err");
            });
        }, delay);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [route, target, routeKey, reduced, s.terms, s.adv.debug],
  );

  useEffect(() => {
    if (!showTrans) return;
    ARTICLE.blocks.forEach((b, i) => {
      const e = trans[b.id];
      if (e && e.key === routeKey && e.st !== "error") return;
      if (e && e.st === "loading" && e.key === routeKey) return;
      setTrans((t) => ({ ...t, [b.id]: { st: "loading", key: routeKey } }));
      resolveBlock(b.id, b.en, b.zh, i);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTrans, routeKey]);

  /* ---------- auto cascade on first view ---------- */
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting && !autoRef.current) {
            autoRef.current = true;
            window.setTimeout(() => setTranslated(true), reduced ? 0 : 650);
            io.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    if (viewRef.current) io.observe(viewRef.current);
    return () => io.disconnect();
  }, [reduced, viewRef]);

  /* ---------- hotkeys ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT";
      if (matchHotkey(s.keys.togglePage, e)) {
        e.preventDefault();
        if (!powered) return toast("扩展已暂停 · 请先在弹窗开启电源", "err");
        const nv = !translatedRef.current;
        setTranslated(nv);
        pushLog(nv ? "翻译本页 · 双语对照" : "收起本页译文");
        toast(nv ? "已翻译本页 · 双语对照" : "已收起本页译文");
      } else if (matchHotkey(s.keys.toggleSide, e)) {
        e.preventDefault();
        setSideOpen((v) => !v);
      } else if (matchHotkey(s.keys.openPanel, e)) {
        e.preventDefault();
        if (!s.ball.enabled || ballHidden) return toast("悬浮球已隐藏 · 设置页「悬浮球」可恢复", "err");
        setQuickOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPopupOpen(false);
        setBubble(null);
        setSelIcon(null);
        setQuickOpen(false);
      } else if (!inField && e.altKey && e.key.toLowerCase() === "s") {
        /* reserved */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.keys, powered, s.ball.enabled, ballHidden, toast, pushLog]);

  /* ---------- outside click closes popup ---------- */
  useEffect(() => {
    if (!popupOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popupRef.current?.contains(t) || iconRef.current?.contains(t)) return;
      setPopupOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popupOpen]);

  /* ---------- hero CTA hook ---------- */
  useEffect(() => {
    const open = () => {
      setView("article");
      setPopupOpen(true);
      rootRef.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    };
    window.addEventListener("ir:open-popup", open);
    return () => window.removeEventListener("ir:open-popup", open);
  }, [reduced]);

  /* ---------- selection ---------- */
  const openBubble = useCallback(
    (text: string, top: number, left: number) => {
      setBubble({ top, left, text, st: "loading" });
      const hit = target === "zh-CN" ? offlineTranslate(text) : null;
      const finish = (t: string, via: string) => {
        const out = applyTerms(t, s.terms);
        setBubble((b) => (b ? { ...b, st: "done", trans: out, via } : b));
        bump(out.length, via === "corpus" ? 0 : 1);
        pushLog(`划词 · ${via === "corpus" ? "演示语料" : via}`, "ok");
        if (s.select.autoCopy) void copyText(out).then((ok) => ok && toast("译文已自动复制"));
      };
      if (hit) {
        window.setTimeout(() => finish(hit, "corpus"), reduced ? 0 : 260);
        setLatency(7);
      } else {
        translate(text, target, route)
          .then((r) => {
            finish(r.text, r.via);
            setLatency(240 + Math.floor(Math.random() * 180));
          })
          .catch(() => {
            setBubble((b) => (b ? { ...b, st: "error" } : b));
            pushLog("划词失败 · 引擎不可达", "err");
          });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, route, reduced, s.terms, s.select.autoCopy],
  );

  const onMouseUp = () => {
    setSelIcon(null);
    if (!powered || !s.select.enabled) return;
    window.setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().replace(/\s*\n\s*/g, " ").trim() ?? "";
      if (!sel || text.length < s.select.minChars || text.length > 400 || sel.isCollapsed) return setBubble(null);
      if (!innerRef.current?.contains(sel.anchorNode)) return;
      const r = sel.getRangeAt(0).getBoundingClientRect();
      const wr = innerRef.current.getBoundingClientRect();
      const left = Math.max(8, Math.min(r.left - wr.left, wr.width - 276));
      if (s.select.mode === "icon") {
        setSelIcon({ top: r.bottom - wr.top + 6, left: r.left - wr.left + r.width / 2 - 14, text });
        setBubble(null);
      } else {
        openBubble(text, r.bottom - wr.top + 10, left);
      }
    }, 0);
  };

  const demoBubble = () => {
    if (!s.select.enabled) return toast("划词翻译已关闭 · 设置页「划词」可开启", "err");
    const el = blockRefs.current["quote"];
    const wr = innerRef.current;
    if (!el || !wr) return;
    setView("article");
    el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
    window.setTimeout(() => {
      const r = el.getBoundingClientRect();
      const w = wr.getBoundingClientRect();
      const q = ARTICLE.blocks.find((b) => b.id === "quote")!;
      openBubble(q.en[0], r.bottom - w.top + 8, 28);
      toast("划词翻译 · 已选取引文句");
    }, reduced ? 0 : 420);
  };

  /* ---------- input translation ---------- */
  const runInput = async (text: string, apply: (v: string) => void, saveOrig: (v: string) => void, busy: (b: boolean) => void) => {
    const clean = text.replace(/\s+$/, "");
    if (clean.trim().length < s.input.minLen) return;
    if (!powered || !s.input.enabled) return toast("输入框翻译未启用 · 设置页「输入框」可开启", "err");
    busy(true);
    try {
      const r = await translate(clean, target, route);
      const out = applyTerms(r.text, s.terms);
      apply(out);
      saveOrig(clean);
      setChars((c) => c + out.length);
      bump(out.length, 1);
      pushLog(`输入框翻译 · ${VIA_LABEL[r.via]}`, "ok");
      toast(`输入内容已翻译 · ${VIA_LABEL[r.via]}`);
    } catch {
      pushLog("输入框翻译失败 · 引擎不可达", "err");
      toast("在线引擎不可达 · 输入翻译失败", "err");
    } finally {
      busy(false);
    }
  };

  const spaceTrigger = s.input.trigger !== "ctrlEnter";
  const enterTrigger = s.input.trigger !== "space3";

  const onCommentChange = (v: string) => {
    setComment(v);
    if (spaceTrigger && /^.*\s{3}$/.test(v) && v.trim().length >= s.input.minLen) {
      const base = v.replace(/\s+$/, "");
      setComment(base);
      void runInput(base, setComment, setCommentOrig, setCommentBusy);
    }
  };

  const copy = async (text: string) => {
    const ok = await copyText(text);
    toast(ok ? "译文已复制到剪贴板" : "复制失败 · 浏览器拒绝访问", ok ? "ok" : "err");
  };

  const reload = () => {
    setTrans({});
    setChars(0);
    setBubble(null);
    setComment("");
    setCommentOrig(null);
    toast("标签页已重新加载");
  };

  const togglePage = () => {
    if (!powered) return toast("扩展已暂停 · 请先在弹窗开启电源", "err");
    const nv = !translatedRef.current;
    setTranslated(nv);
    pushLog(nv ? "翻译本页 · 双语对照" : "收起本页译文");
    toast(nv ? "已翻译本页 · 双语对照" : "已收起本页译文");
  };

  /* ---------- side panel ---------- */
  const outline: OutlineItem[] = ARTICLE.blocks.map((b) => ({
    id: b.id,
    label: b.kind === "title" ? b.zh[0] : b.en[0].slice(0, 30) + (b.en[0].length > 30 ? "…" : ""),
    state: trans[b.id]?.st ?? "idle",
  }));
  const jump = (id: string) => {
    const el = blockRefs.current[id];
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: Math.max(0, el.offsetTop - 16), behavior: reduced ? "auto" : "smooth" });
  };
  const ask = useCallback(
    async (text: string): Promise<string> => {
      if (/摘要|概览|summary/i.test(text))
        return `本页共 ${ARTICLE.blocks.length} 段，已译 ${outline.filter((o) => o.state === "done").length} 段；目标 ${target}，路由 ${route}，本次会话已译 ${chars.toLocaleString()} 字。`;
      if (/[A-Za-z]{3,}/.test(text)) {
        const r = await translate(text, target, route);
        return applyTerms(r.text, s.terms);
      }
      return "我可以翻译你丢进来的英文，或回答「摘要」。也可以试试划词、悬停与三次空格。";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, route, chars, s.terms],
  );

  /* ---------- hover preview ---------- */
  const enterBlock = (id: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (mode !== "source" || !powered || !s.hover.enabled) return;
    const need = s.hover.modifier;
    if (need === "alt" && !pressed.current.alt) return;
    if (need === "ctrl" && !pressed.current.ctrl) return;
    hoverTimer.current = window.setTimeout(() => setHoverId(id), reduced ? 0 : s.hover.delay);
  };
  const leaveBlock = (id: string) => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setHoverId((h) => (h === id ? null : h));
  };

  /* ---------- render ---------- */
  const transFont = style.font === "serif" ? "font-display" : "font-body";
  const dividerNode =
    style.divider === "none" ? null : (
      <div className={`sep-draw mb-2 mt-3 border-t ${style.divider === "dashed" ? "border-dashed" : "border-solid"} border-[#d9d1bf]`} />
    );

  const renderTrans = (b: (typeof ARTICLE.blocks)[number], idx: number) => {
    const e = trans[b.id];
    const ghost = mode === "source";
    const visible = ghost ? powered && (pinned[b.id] || (s.hover.enabled && hoverId === b.id)) : showTrans;
    if (!visible) return null;
    if (!e || e.st === "loading")
      return (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-3 w-[92%] animate-pulse rounded bg-[#ddd5c4]/80" />
          <div className="h-3 w-[68%] animate-pulse rounded bg-[#ddd5c4]/60" />
        </div>
      );
    if (e.st === "error")
      return (
        <div className="mt-3 inline-flex items-center gap-2 rounded border border-[#d5482f]/50 bg-[#d5482f]/5 px-2 py-1 font-mono text-[11px] text-[#b23f2a]">
          引擎无响应
          <button className="underline underline-offset-2 hover:text-[#d5482f]" onClick={() => resolveBlock(b.id, b.en, b.zh, 0)}>
            重试
          </button>
        </div>
      );
    return (
      <div
        className={`trans-in ir-trans group/trans relative ${ghost && !pinned[b.id] ? "rounded bg-[#ece6d8]/70 px-2 py-1" : ""}`}
        style={{ animationDelay: reduced ? undefined : `${idx * 85}ms` }}
      >
        {dividerNode}
        <p
          className={`${transFont} ${COLOR_CLASS[style.color]} leading-[1.95] tracking-[0.01em]`}
          style={{ fontSize: s.basic.fontSize }}
        >
          {e.text}
        </p>
        <div className="absolute -right-1 top-0 flex gap-1 opacity-0 transition-opacity group-hover/trans:opacity-100">
          <button
            title="复制译文"
            onClick={() => copy(e.text!)}
            className="rounded border border-[#d9d1bf] bg-[#f5f1e8] p-1 text-[#5d6169] transition-colors hover:border-[#d5482f] hover:text-[#b23f2a]"
          >
            <IconCopy className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#b3ab99]">
          {VIA_LABEL[(e.via as keyof typeof VIA_LABEL) ?? "corpus"]}
        </span>
      </div>
    );
  };

  const gutter = (b: (typeof ARTICLE.blocks)[number]) =>
    (b.kind === "p" || b.kind === "quote") && (
      <button
        title={pinned[b.id] ? "取消固定译文" : "固定该段译文"}
        onClick={() => setPinned((p) => ({ ...p, [b.id]: !p[b.id] }))}
        className={`absolute -left-7 top-1 hidden rounded p-1 transition-all md:block ${
          pinned[b.id] ? "text-[#b23f2a] opacity-100" : "text-[#b3ab99] opacity-0 hover:text-[#b23f2a] group-hover:opacity-100"
        }`}
      >
        <IconPin className="h-3.5 w-3.5" />
      </button>
    );

  const blocks = ARTICLE.blocks.map((b, i) => {
    const refCb = (el: HTMLElement | null) => {
      blockRefs.current[b.id] = el;
    };
    const inner = (node: ReactNode, cls: string) => (
      <div key={b.id} ref={refCb} className={`group relative ${cls}`} onMouseEnter={() => enterBlock(b.id)} onMouseLeave={() => leaveBlock(b.id)}>
        {gutter(b)}
        {s.basic.position === "above" ? (
          <>
            {renderTrans(b, i)}
            {node}
          </>
        ) : (
          <>
            {node}
            {renderTrans(b, i)}
          </>
        )}
      </div>
    );
    if (b.kind === "title")
      return inner(
        <h3 className={`font-display text-[26px] font-black leading-tight text-[#22262c] md:text-[32px] ${mode === "only" && showTrans ? "hidden" : ""}`}>
          {b.en[0]}
        </h3>,
        "pt-2",
      );
    if (b.kind === "deck")
      return inner(<p className={`text-[15px] italic leading-relaxed text-[#5d6169] ${mode === "only" && showTrans ? "hidden" : ""}`}>{b.en[0]}</p>, "mt-3");
    if (b.kind === "quote")
      return inner(
        <blockquote
          className={`border-l-2 border-[#d5482f] pl-4 font-display text-[19px] font-semibold leading-snug text-[#22262c] ${mode === "only" && showTrans ? "hidden" : ""}`}
        >
          {b.en[0]}
        </blockquote>,
        "my-7",
      );
    const after = b.id === "p2" && (
      <figure className="my-7 overflow-hidden rounded-sm border border-[#d9d1bf]">
        <div className="h-44 overflow-hidden md:h-56">
          <img src={articleImg} alt="ink-wash illustration of a reader at night" className="kenburns h-full w-full object-cover" />
        </div>
        <figcaption className="flex items-center justify-between bg-[#ece6d8] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a8371]">
          <span>fig.01 — borrowed cognition</span>
          <span>ink / riso</span>
        </figcaption>
      </figure>
    );
    return (
      <div key={b.id}>
        {inner(<p className={`text-[15.5px] leading-[1.95] text-[#22262c] ${mode === "only" && showTrans ? "hidden" : ""}`}>{b.en.join(" ")}</p>, "my-5")}
        {after}
      </div>
    );
  });

  const sampleChips = (apply: (v: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {INPUT_SAMPLES.map((sm, i) => (
        <button
          key={i}
          onClick={() => apply(sm.en)}
          className="rounded-full border border-[#d9d1bf] bg-[#f5f1e8] px-2.5 py-1 font-mono text-[10.5px] text-[#5d6169] transition-all hover:-translate-y-0.5 hover:border-[#2e7d74] hover:text-[#2b6d64]"
        >
          示例 {i + 1}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={viewRef} className="relative">
      <div ref={rootRef} className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0b0d10] shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)]">
        {/* tab strip */}
        <div className="flex items-end gap-1 border-b border-white/5 bg-[#14171b] px-2 pt-1.5">
          <button
            onClick={() => setView("article")}
            className={`flex max-w-[220px] items-center gap-2 rounded-t-md px-3 py-2 text-[11.5px] transition-colors ${
              view === "article" ? "bg-[#1a2028] text-bone" : "text-mute hover:bg-white/5 hover:text-bone-dim"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-[#d5482f]" />
            <span className="truncate">Why We Still Read — The Reading Room</span>
          </button>
          <button
            onClick={() => setView("newtab")}
            className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-[11.5px] transition-colors ${
              view === "newtab" ? "bg-[#1a2028] text-bone" : "text-mute hover:bg-white/5 hover:text-bone-dim"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            新标签页
          </button>
          {view === "settings" && (
            <button className="flex max-w-[220px] items-center gap-2 rounded-t-md bg-[#1a2028] px-3 py-2 text-[11.5px] text-bone">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2e7d74]" />
              <span className="truncate">设置 — AI 沉浸翻译</span>
              <span onClick={(e) => { e.stopPropagation(); setView("article"); }} className="rounded p-0.5 text-mute hover:bg-white/10 hover:text-bone">
                <IconClose className="h-3 w-3" />
              </span>
            </button>
          )}
          <button onClick={() => setView("newtab")} title="新建标签" className="mb-1 ml-1 rounded p-1 text-mute transition-colors hover:bg-white/5 hover:text-bone-dim">
            <IconPlus className="h-3.5 w-3.5" />
          </button>
          <div className="mb-2 ml-auto flex gap-1.5 pr-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a424d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a424d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a424d]" />
          </div>
        </div>

        {/* toolbar */}
        <div className="relative flex items-center gap-1.5 border-b border-white/5 bg-[#1a2028] px-2.5 py-2">
          <button
            disabled={view === "article"}
            onClick={() => setView("article")}
            className="rounded p-1.5 text-mute transition-colors enabled:hover:bg-white/5 enabled:hover:text-bone disabled:opacity-30"
            title="后退"
          >
            <IconBack className="h-4 w-4" />
          </button>
          <button onClick={reload} className="rounded p-1.5 text-mute transition-colors hover:bg-white/5 hover:text-bone" title="重新加载">
            <IconReload className="h-4 w-4" />
          </button>
          <div className="mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/5 bg-[#10141a] px-3 py-1.5">
            <IconLock className="h-3.5 w-3.5 shrink-0 text-[#57a79b]" />
            <span className="truncate font-mono text-[11.5px] text-bone-dim">
              {view === "settings" ? (
                <>chrome://extensions · <span className="text-bone">translate-ext / options</span></>
              ) : (
                <>https://<span className="text-bone">{ARTICLE.url}</span></>
              )}
            </span>
            <span className="ml-auto hidden shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-mute sm:block">
              en → {TARGETS.find((t) => t.code === target)?.label}
            </span>
          </div>
          <button
            onClick={() => setSideOpen((v) => !v)}
            title={`侧边栏（${s.keys.toggleSide}）`}
            className={`rounded-md border p-1.5 transition-all hover:-translate-y-px ${
              sideOpen ? "border-[#57a79b]/60 bg-[#2e7d74]/15 text-[#57a79b]" : "border-white/10 bg-white/5 text-bone-dim hover:text-bone"
            }`}
          >
            <IconPanelRight className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setView("settings")}
            title="完整设置页"
            className={`rounded-md border p-1.5 transition-all hover:-translate-y-px ${
              view === "settings" ? "border-[#d5482f]/60 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 bg-white/5 text-bone-dim hover:text-bone"
            }`}
          >
            <IconGear className="h-4.5 w-4.5" />
          </button>
          <button
            ref={iconRef}
            onClick={() => setPopupOpen((v) => !v)}
            title="AI 沉浸翻译 扩展弹窗"
            className={`relative rounded-md border p-1.5 transition-all hover:-translate-y-px ${
              popupOpen ? "border-[#d5482f]/60 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 bg-white/5 text-bone-dim hover:text-bone"
            }`}
          >
            <Logo className="h-5 w-5" />
            {showTrans && (
              <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#d5482f] px-0.5 font-mono text-[8.5px] font-semibold text-[#f5f1e8]">
                {ARTICLE.blocks.length}
              </span>
            )}
          </button>
          <span className="ml-0.5 h-5 w-5 rounded-full bg-gradient-to-br from-[#2e7d74] to-[#1f4f49]" />

          {/* popup */}
          {popupOpen && (
            <div
              ref={popupRef}
              className="pop-in scroll-dark absolute right-2 top-[calc(100%+8px)] z-40 max-h-[548px] w-[302px] overflow-y-auto rounded-lg border border-white/10 bg-[#141920] shadow-[0_28px_60px_-18px_rgba(0,0,0,0.9)]"
            >
              <div className="flex items-center gap-2 border-b border-white/5 px-3.5 py-3">
                <Logo className="h-6 w-6 text-bone" />
                <div className="leading-tight">
                  <p className="font-display text-[13.5px] font-bold text-bone">AI 沉浸翻译</p>
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">open source · v1.2.1</p>
                </div>
                <button
                  role="switch"
                  aria-checked={powered}
                  onClick={() => {
                    setPowered(!powered);
                    toast(!powered ? "扩展已启用" : "扩展已暂停");
                  }}
                  className={`ml-auto relative h-[18px] w-[34px] rounded-full transition-colors ${powered ? "bg-[#2e7d74]" : "bg-ink-600"}`}
                  title="扩展电源"
                >
                  <span className={`absolute top-[3px] h-3 w-3 rounded-full bg-bone transition-all ${powered ? "left-[18px]" : "left-[3px]"}`} />
                </button>
              </div>
              <div className="space-y-3 px-3.5 py-3">
                <button
                  disabled={!powered}
                  onClick={togglePage}
                  className="w-full rounded-md bg-[#d5482f] py-2 text-[13px] font-medium text-[#f5f1e8] transition-all hover:-translate-y-px hover:bg-[#ef6a4c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {translated ? "收起译文 · 显示原文" : "翻译本页 · 双语对照"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">目标语言</span>
                    <select
                      value={target}
                      onChange={(e) => set("basic", { target: e.target.value as typeof target })}
                      className="w-full rounded border border-white/10 bg-[#1a2028] px-2 py-1.5 text-[11.5px] text-bone outline-none focus:border-[#d5482f]/60"
                    >
                      {TARGETS.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.label}
                          {t.offline ? " ·离线" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">翻译服务</span>
                    <select
                      value={route}
                      onChange={(e) => set("services", { route: e.target.value as typeof route })}
                      className="w-full rounded border border-white/10 bg-[#1a2028] px-2 py-1.5 text-[11.5px] text-bone outline-none focus:border-[#d5482f]/60"
                    >
                      <option value="auto">自动路由</option>
                      <option value="google">Google</option>
                      <option value="deepl">DeepL</option>
                    </select>
                  </label>
                </div>
                <div>
                  <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">显示模式</span>
                  <div className="flex rounded-md bg-[#1a2028] p-0.5">
                    {(["bilingual", "only", "source"] as DisplayMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex-1 rounded py-1 text-[11px] transition-colors ${mode === m ? "bg-[#d5482f] text-[#f5f1e8]" : "text-mute hover:text-bone"}`}
                      >
                        {m === "bilingual" ? "双语对照" : m === "only" ? "仅译文" : "原文"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">分隔符</span>
                    <div className="flex gap-1">
                      {(["none", "line", "dashed"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setStyle({ ...style, divider: d })}
                          className={`flex-1 rounded border py-1 text-[10.5px] transition-colors ${
                            style.divider === d ? "border-[#d5482f]/70 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 text-mute hover:text-bone"
                          }`}
                        >
                          {d === "none" ? "无" : d === "line" ? "细线" : "虚线"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">译文配色</span>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {(Object.keys(SWATCH) as TransStyle["color"][]).map((c) => (
                        <button
                          key={c}
                          title={c}
                          onClick={() => setStyle({ ...style, color: c })}
                          className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${style.color === c ? "border-bone" : "border-transparent"}`}
                          style={{ background: SWATCH[c] }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">译文字体</span>
                    <div className="flex gap-1">
                      {(["serif", "sans"] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setStyle({ ...style, font: f })}
                          className={`flex-1 rounded border py-1 text-[10.5px] transition-colors ${
                            style.font === f ? "border-[#d5482f]/70 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 text-mute hover:text-bone"
                          } ${f === "serif" ? "font-display" : ""}`}
                        >
                          {f === "serif" ? "衬线 · 宋" : "无衬线 · 黑"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-0.5 border-t border-white/5 pt-2">
                  <Toggle on={s.hover.enabled} setT={(v) => set("hover", { enabled: v })} label="悬停试译（原文模式下）" />
                  <Toggle on={s.input.enabled} setT={(v) => set("input", { enabled: v })} label="输入框翻译（三次空格）" />
                  <Toggle on={s.ball.enabled} setT={(v) => set("ball", { enabled: v })} label="网页悬浮球" />
                  <Toggle on={sideOpen} setT={setSideOpen} label="侧边栏" />
                </div>
                <button
                  onClick={() => {
                    setView("settings");
                    setPopupOpen(false);
                  }}
                  className="w-full rounded-md border border-white/10 py-1.5 font-mono text-[11px] text-bone-dim transition-colors hover:border-[#d5482f]/60 hover:text-[#ef6a4c]"
                >
                  打开完整设置页 →
                </button>
                <div className="space-y-1.5 rounded-md bg-[#10141a] p-2.5 font-mono text-[10px] text-mute">
                  <p className="flex items-center justify-between">翻译 / 收起本页 <span className="kbd">{s.keys.togglePage}</span></p>
                  <p className="flex items-center justify-between">快捷面板 <span className="kbd">{s.keys.openPanel}</span></p>
                  <p className="flex items-center justify-between">侧边栏 <span className="kbd">{s.keys.toggleSide}</span></p>
                  <p className="flex items-center justify-between">翻译输入框 <span className="kbd">空格 ×3</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* page surface + side panel */}
        <div className="flex h-[560px] md:h-[620px]">
          <div className="relative min-w-0 flex-1">
            {s.adv.css && <style>{s.adv.css}</style>}
            <div
              ref={scrollRef}
              onMouseUp={onMouseUp}
              className={`scroll-slim h-full overflow-y-auto ${view === "settings" ? "scroll-dark bg-[#0e1216]" : "bg-[#f5f1e8]"}`}
            >
              {view === "settings" ? (
                <SettingsPage mode={mode} setMode={setMode} style={style} setStyle={setStyle} />
              ) : (
                <div ref={innerRef} className="ir-page relative mx-auto max-w-[680px] px-6 pb-16 pt-8 md:px-10">
                  {view === "article" ? (
                    <>
                      <header className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#d9d1bf] pb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8a8371]">
                        <span className="text-[#b23f2a]">{ARTICLE.pub}</span>
                        <span>{ARTICLE.issue}</span>
                        <span className="ml-auto normal-case tracking-normal">
                          {ARTICLE.author} · {ARTICLE.date} · {ARTICLE.read}
                        </span>
                      </header>
                      {blocks}
                      <section className="mt-10 rounded-md border border-[#d9d1bf] bg-[#ece6d8] p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8a8371]">comments · 输入框翻译演练</h4>
                          {commentBusy && (
                            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#2b6d64]">
                              <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#2e7d74] border-t-transparent" />
                              翻译中
                            </span>
                          )}
                        </div>
                        <textarea
                          ref={commentRef}
                          rows={3}
                          value={comment}
                          onChange={(e) => onCommentChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (enterTrigger && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
                              e.preventDefault();
                              void runInput(comment, setComment, setCommentOrig, setCommentBusy);
                            }
                          }}
                          placeholder="Type English here, then press space three times… 例如点击「示例 1」后连按三次空格。"
                          className="w-full resize-none rounded border border-[#d9d1bf] bg-[#f5f1e8] px-3 py-2 text-[14px] leading-relaxed text-[#22262c] outline-none transition-shadow placeholder:text-[#b3ab99] focus:border-[#2e7d74] focus:shadow-[0_0_0_3px_rgba(46,125,116,0.15)]"
                        />
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {sampleChips((v) => {
                            setComment(v);
                            commentRef.current?.focus();
                          })}
                          <span className="mx-1 h-4 w-px bg-[#d9d1bf]" />
                          {spaceTrigger && <span className="kbd !border-[#c8bfa9] !bg-transparent !text-[#8a8371]">空格 ×3</span>}
                          {enterTrigger && <span className="kbd !border-[#c8bfa9] !bg-transparent !text-[#8a8371]">Ctrl + Enter</span>}
                          {commentOrig && (
                            <button
                              onClick={() => {
                                setComment(commentOrig);
                                setCommentOrig(null);
                              }}
                              className="ml-auto font-mono text-[10.5px] text-[#b23f2a] underline underline-offset-2 hover:text-[#d5482f]"
                            >
                              还原原文
                            </button>
                          )}
                        </div>
                      </section>
                    </>
                  ) : (
                    <div className="flex min-h-[480px] flex-col items-center justify-center gap-4 py-10 text-center">
                      <Logo className="float-y h-14 w-14 text-[#22262c]" />
                      <div>
                        <p className="font-display text-[22px] font-black text-[#22262c]">新标签页 · 输入即译</p>
                        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#8a8371]">type → space space space → translated</p>
                      </div>
                      <div className="w-full max-w-md">
                        <input
                          value={ntInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setNtInput(v);
                            if (spaceTrigger && /\s{3}$/.test(v) && v.trim().length >= s.input.minLen) {
                              const base = v.replace(/\s+$/, "");
                              setNtInput(base);
                              void runInput(base, setNtInput, () => {}, setNtBusy);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (enterTrigger && (e.ctrlKey || e.metaKey) && e.key === "Enter") void runInput(ntInput, setNtInput, () => {}, setNtBusy);
                          }}
                          placeholder="Reading is talking with the dead on their best days..."
                          className="w-full rounded-full border border-[#d9d1bf] bg-[#f5f1e8] px-4 py-2.5 text-[14px] text-[#22262c] outline-none transition-shadow placeholder:text-[#b3ab99] focus:border-[#2e7d74] focus:shadow-[0_0_0_3px_rgba(46,125,116,0.15)]"
                        />
                        <div className="mt-3 flex justify-center gap-1.5">
                          {sampleChips(setNtInput)}
                          {ntBusy && <span className="h-2.5 w-2.5 animate-spin rounded-full border border-[#2e7d74] border-t-transparent" />}
                        </div>
                      </div>
                      <button onClick={() => setView("article")} className="mt-2 font-mono text-[11px] text-[#b23f2a] underline underline-offset-4 hover:text-[#d5482f]">
                        回到文章标签页 →
                      </button>
                    </div>
                  )}

                  {/* selection icon (icon mode) */}
                  {selIcon && (
                    <button
                      onClick={() => {
                        openBubble(selIcon.text, selIcon.top + 26, Math.max(8, selIcon.left - 120));
                        setSelIcon(null);
                      }}
                      title="翻译所选内容"
                      className="pop-in absolute z-30 rounded-full border border-[#d5482f]/60 bg-[#141920] p-1.5 text-[#ef6a4c] shadow-lg transition-transform hover:scale-110"
                      style={{ top: selIcon.top, left: selIcon.left }}
                    >
                      <Logo className="h-4 w-4" />
                    </button>
                  )}

                  {/* selection bubble */}
                  {bubble && (
                    <div
                      className="pop-in absolute z-30 w-[268px] rounded-md border border-white/10 bg-[#141920]/[0.98] p-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]"
                      style={{ top: bubble.top, left: bubble.left }}
                    >
                      <div className="mb-1.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-mute">
                        划词翻译 · {bubble.st === "done" ? VIA_LABEL[(bubble.via as keyof typeof VIA_LABEL) ?? "corpus"] : bubble.st === "error" ? "失败" : "…"}
                        <button onClick={() => setBubble(null)} className="text-mute hover:text-bone">
                          <IconClose className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mb-1.5 max-h-16 overflow-hidden text-[10.5px] italic leading-snug text-ink-500">“{bubble.text.slice(0, 90)}”</p>
                      {bubble.st === "loading" && (
                        <div className="space-y-1.5 py-1">
                          <div className="h-2.5 w-[85%] animate-pulse rounded bg-ink-600" />
                          <div className="h-2.5 w-[60%] animate-pulse rounded bg-ink-600" />
                        </div>
                      )}
                      {bubble.st === "done" && <p className="text-[12.5px] leading-relaxed text-bone">{bubble.trans}</p>}
                      {bubble.st === "error" && (
                        <p className="text-[11px] leading-relaxed text-[#ef6a4c]">
                          在线引擎不可达，且所选内容不在内置语料中。
                          <button onClick={() => openBubble(bubble.text, bubble.top, bubble.left)} className="ml-1 underline underline-offset-2">
                            重试
                          </button>
                        </p>
                      )}
                      {bubble.st === "done" && (
                        <div className="mt-2 flex gap-2 border-t border-white/5 pt-2">
                          <button onClick={() => copy(bubble.trans!)} className="flex items-center gap-1 font-mono text-[10px] text-bone-dim transition-colors hover:text-bone">
                            <IconCopy className="h-3 w-3" /> 复制译文
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* floating ball + quick panel */}
            {view !== "settings" && !ballHidden && (
              <FloatingBall
                quickOpen={quickOpen}
                setQuickOpen={setQuickOpen}
                translated={translated}
                mode={mode}
                setMode={setMode}
                onAction={(a) => {
                  if (a === "translate") togglePage();
                  else if (a === "settings") setView("settings");
                  else if (a === "sidebar") setSideOpen(true);
                  else if (a === "hide") {
                    setBallHidden(true);
                    setQuickOpen(false);
                    toast("悬浮球已隐藏 · 弹窗或设置页可恢复");
                  }
                }}
              />
            )}

            {/* toasts */}
            <div className="pointer-events-none absolute bottom-3 right-3 z-40 flex w-[260px] flex-col gap-2">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={`toast-in rounded border border-white/10 bg-[#141920]/95 px-3 py-2 text-[11.5px] leading-snug text-bone shadow-lg ${
                    t.tone === "err" ? "border-l-2 border-l-[#d5482f]" : "border-l-2 border-l-[#57a79b]"
                  }`}
                >
                  {t.msg}
                </div>
              ))}
            </div>
          </div>

          <SidePanel open={sideOpen} onClose={() => setSideOpen(false)} outline={outline} onJump={jump} ask={ask} />
        </div>

        {/* status bar */}
        <div className="flex h-8 items-center gap-3 border-t border-white/5 bg-[#10141a] px-3 font-mono text-[10px] text-mute">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${powered ? "pulse-dot bg-[#57a79b]" : "bg-ink-600"}`} />
            {powered ? (route === "auto" && target === "zh-CN" ? "演示语料 · 离线" : `路由 → ${route}`) : "扩展暂停中"}
          </span>
          <span className="hidden sm:inline">{latency !== null ? `≈ ${latency} ms` : "—"}</span>
          <span className="hidden md:inline">模式 · {mode === "bilingual" ? "双语对照" : mode === "only" ? "仅译文" : "原文 + 悬停试译"}</span>
          <span className="hidden lg:inline">球 · {s.ball.enabled && !ballHidden ? "在" : "隐"}　栏 · {sideOpen ? "开" : "关"}</span>
          <span className="ml-auto">{chars.toLocaleString()} 字已译</span>
          <span className="kbd hidden sm:inline-block">{s.keys.togglePage}</span>
        </div>
      </div>

      {/* caption chips */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {[
          {
            label: "① 看双语对照",
            fn: () => {
              setPowered(true);
              setMode("bilingual");
              setTranslated(true);
              toast("双语对照 · 原文在上，译文在下");
            },
          },
          { label: "② 看划词翻译", fn: demoBubble },
          {
            label: "③ 试输入框翻译",
            fn: () => {
              setView("article");
              commentRef.current?.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
              commentRef.current?.focus({ preventScroll: true });
              setComment(INPUT_SAMPLES[0].en);
              toast("已填入示例 · 连按三次空格触发翻译");
            },
          },
          {
            label: "④ 悬浮球 / 快捷面板",
            fn: () => {
              set("ball", { enabled: true });
              setBallHidden(false);
              setView("article");
              setQuickOpen(true);
              toast("悬浮球已就位 · 快捷面板展开");
            },
          },
          { label: "⑤ 侧边栏", fn: () => setSideOpen(true) },
          { label: "⑥ 完整设置页", fn: () => setView("settings") },
        ].map((c) => (
          <button
            key={c.label}
            onClick={c.fn}
            className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-bone-dim transition-all hover:-translate-y-0.5 hover:border-[#d5482f]/70 hover:text-[#ef6a4c]"
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto hidden font-mono text-[10.5px] text-ink-500 md:block">
          模拟环境 · 工具栏 <span className="text-[#ef6a4c]">文/A</span> 弹窗 · <span className="text-[#57a79b]">齿轮</span> 设置 · <span className="text-[#57a79b]">竖栏</span> 侧边栏
        </span>
      </div>
    </div>
  );
}
