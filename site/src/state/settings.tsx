import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TargetCode } from "../data/content";

export type DisplayMode = "bilingual" | "only" | "source";
export type TransStyle = {
  divider: "none" | "line" | "dashed";
  color: "jade" | "cinnabar" | "ink" | "gold";
  font: "serif" | "sans";
};
export type RouteMode = "auto" | "google" | "deepl";

export type Term = { id: number; src: string; dst: string; dom: string };
export type LogEntry = { id: number; t: number; msg: string; kind: "ok" | "err" | "info" };

export type Settings = {
  basic: {
    uiLang: "zh-CN" | "en";
    sourceAuto: boolean;
    target: TargetCode;
    mode: DisplayMode;
    position: "below" | "above";
    fontSize: number;
    alwaysLangs: string[];
    neverSites: string[];
  };
  services: {
    route: RouteMode;
    aiEngine: string;
    concurrency: number;
    interval: number;
    keys: { deepl: string; openai: string };
  };
  ai: { enabled: boolean; expert: string; temperature: number; prompt: string };
  terms: { enabled: boolean; list: Term[] };
  subs: { enabled: boolean; engine: string; position: "above" | "below"; size: number; bgOpacity: number };
  comic: { enabled: boolean; confidence: number; bg: "paper" | "white" | "auto"; typeset: "auto" | "vertical" };
  input: { enabled: boolean; trigger: "space3" | "ctrlEnter" | "both"; minLen: number; blacklist: string[] };
  select: { enabled: boolean; mode: "auto" | "icon"; minChars: number; autoCopy: boolean };
  hover: { enabled: boolean; delay: number; modifier: "none" | "alt" | "ctrl" };
  ball: {
    enabled: boolean;
    pos: "rm" | "rb" | "lm" | "lb";
    size: number;
    opacity: number;
    drag: boolean;
    click: "panel" | "translate";
  };
  keys: { togglePage: string; openPanel: string; toggleSide: string };
  adv: { css: string; cacheTTL: number; debug: boolean; experimental: boolean };
};

export const EXPERTS = [
  { id: "literary", name: "文学翻译家", desc: "保留节奏与意象，宁可失准也不失味", prompt: "你是文学翻译家。保留原文的节奏、意象与留白，中文用现代书面语，避免翻译腔。" },
  { id: "academic", name: "学术论文编辑", desc: "术语精确、句式严谨、可被引用", prompt: "你是学术编辑。术语精确一致，句式严谨被动优先，输出可直接进入论文引用。" },
  { id: "legal", name: "商务合同律师", desc: "定义项锁定、义务句式无歧义", prompt: "你是合同律师。锁定定义项与义务句式（shall/应当），不添加解释，不软化责任边界。" },
  { id: "code", name: "代码注释工程师", desc: "简洁直白，保留标识符与代码块", prompt: "你是工程师。注释翻译简洁直白，标识符、API 名与代码块保持原样不译。" },
  { id: "casual", name: "社区口语伙伴", desc: "接地气、带语气，像楼主回帖", prompt: "你是论坛老用户。口语化、带语气词，梗要落地，允许意译换取好笑。" },
];

export const DEFAULTS: Settings = {
  basic: {
    uiLang: "zh-CN",
    sourceAuto: true,
    target: "zh-CN",
    mode: "bilingual",
    position: "below",
    fontSize: 15,
    alwaysLangs: ["English", "日本語"],
    neverSites: ["github.com", "localhost"],
  },
  services: {
    route: "auto",
    aiEngine: "OpenAI 兼容",
    concurrency: 5,
    interval: 200,
    keys: { deepl: "", openai: "" },
  },
  ai: { enabled: true, expert: "literary", temperature: 0.4, prompt: EXPERTS[0].prompt },
  terms: {
    enabled: true,
    list: [
      { id: 1, src: "deep reading", dst: "深度阅读", dom: "阅读科学" },
      { id: 2, src: "narrative transport", dst: "叙事传输", dom: "心理学" },
      { id: 3, src: "bilingual pages", dst: "双语页面", dom: "产品" },
    ],
  },
  subs: { enabled: true, engine: "Google", position: "below", size: 15, bgOpacity: 55 },
  comic: { enabled: true, confidence: 72, bg: "paper", typeset: "auto" },
  input: { enabled: true, trigger: "both", minLen: 3, blacklist: ["password", "search"] },
  select: { enabled: true, mode: "auto", minChars: 4, autoCopy: false },
  hover: { enabled: true, delay: 420, modifier: "none" },
  ball: { enabled: true, pos: "rb", size: 52, opacity: 92, drag: true, click: "panel" },
  keys: { togglePage: "Alt+Q", openPanel: "Alt+W", toggleSide: "Alt+E" },
  adv: { css: "", cacheTTL: 7, debug: false, experimental: false },
};

const LS_KEY = "ir-settings-v3";

type Ctx = {
  s: Settings;
  set: <K extends keyof Settings>(k: K, patch: Partial<Settings[K]>) => void;
  log: LogEntry[];
  pushLog: (msg: string, kind?: LogEntry["kind"]) => void;
  clearLog: () => void;
  stats: { chars: number; reqs: number };
  bump: (chars: number, reqs?: number) => void;
  resetAll: () => void;
  importJson: (raw: string) => string | null;
};

const SettingsCtx = createContext<Ctx | null>(null);

let logSeq = 0;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULTS, ...parsed, basic: { ...DEFAULTS.basic, ...parsed.basic }, services: { ...DEFAULTS.services, ...parsed.services } };
      }
    } catch {
      /* ignore */
    }
    return DEFAULTS;
  });
  const [log, setLog] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ chars: 0, reqs: 0 });
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  const set = useCallback(<K extends keyof Settings>(k: K, patch: Partial<Settings[K]>) => {
    setS((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));
  }, []);

  const pushLog = useCallback((msg: string, kind: LogEntry["kind"] = "info") => {
    setLog((l) => [...l.slice(-59), { id: ++logSeq, t: Date.now(), msg, kind }]);
  }, []);
  const clearLog = useCallback(() => setLog([]), []);
  const bump = useCallback((chars: number, reqs = 1) => {
    setStats((st) => ({ chars: st.chars + chars, reqs: st.reqs + reqs }));
  }, []);
  const resetAll = useCallback(() => {
    setS(DEFAULTS);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const importJson = useCallback((raw: string): string | null => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) return "JSON 根节点必须是对象";
      setS((prev) => {
        const next: Settings = { ...prev };
        (Object.keys(DEFAULTS) as (keyof Settings)[]).forEach((k) => {
          if (parsed[k] && typeof parsed[k] === "object") next[k] = { ...prev[k], ...parsed[k] };
        });
        return next;
      });
      return null;
    } catch (e) {
      return `解析失败：${(e as Error).message}`;
    }
  }, []);

  const value = useMemo(
    () => ({ s, set, log, pushLog, clearLog, stats, bump, resetAll, importJson }),
    [s, set, log, pushLog, clearLog, stats, bump, resetAll, importJson],
  );
  return <SettingsCtx.Provider value={value}>{children}</SettingsCtx.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings outside provider");
  return ctx;
}

/* ---------- utils ---------- */
const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function applyTerms(text: string, terms: Settings["terms"]): string {
  if (!terms.enabled || !terms.list.length) return text;
  let out = text;
  for (const t of terms.list) {
    if (!t.src || !t.dst) continue;
    const latin = /^[\x00-\x7F]+$/.test(t.src);
    try {
      out = out.replace(new RegExp(esc(t.src), latin ? "gi" : "g"), t.dst);
    } catch {
      /* skip bad term */
    }
  }
  return out;
}

export function parseCombo(combo: string) {
  const parts = combo.split("+");
  const key = (parts.pop() ?? "").toLowerCase();
  return {
    alt: parts.includes("Alt"),
    ctrl: parts.includes("Ctrl"),
    meta: parts.includes("Meta"),
    shift: parts.includes("Shift"),
    key,
  };
}

export function matchHotkey(combo: string, e: KeyboardEvent): boolean {
  const c = parseCombo(combo);
  const key = e.key.toLowerCase();
  return c.alt === e.altKey && c.ctrl === e.ctrlKey && c.meta === e.metaKey && c.shift === e.shiftKey && c.key === key;
}

export function comboFromEvent(e: KeyboardEvent): string | null {
  if (["Alt", "Control", "Meta", "Shift"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.metaKey) parts.push("Meta");
  if (e.shiftKey) parts.push("Shift");
  parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

export function fmtClock(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
