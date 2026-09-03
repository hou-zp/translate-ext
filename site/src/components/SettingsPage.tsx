import { useEffect, useRef, useState, type ReactNode } from "react";
import { TARGETS } from "../data/content";
import { copyText, translate } from "../lib/translate";
import {
  comboFromEvent,
  DEFAULTS,
  EXPERTS,
  useSettings,
  type DisplayMode,
  type Settings,
  type TransStyle,
} from "../state/settings";
import {
  IconBall,
  IconBook,
  IconBot,
  IconCaption,
  IconCheck,
  IconCopy,
  IconDb,
  IconGear,
  IconGlobe,
  IconHover,
  IconImage,
  IconInfo,
  IconInput,
  IconKeyboard,
  IconPause,
  IconPlay,
  IconPlus,
  IconRoute,
  IconSelect,
  Logo,
} from "./Icons";

/* ============ control kit ============ */
function Row({ label, hint, children, stack }: { label: string; hint?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`border-b border-white/5 py-3 last:border-0 ${stack ? "" : "flex items-center gap-4"}`}>
      <div className={stack ? "mb-2" : "min-w-0 flex-1"}>
        <p className="text-[12.5px] text-bone">{label}</p>
        {hint && <p className="mt-0.5 font-mono text-[9.5px] leading-relaxed text-ink-500">{hint}</p>}
      </div>
      <div className={stack ? "" : "shrink-0"}>{children}</div>
    </div>
  );
}

function Tgl({ on, set }: { on: boolean; set: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className={`relative h-[18px] w-[34px] rounded-full transition-colors ${on ? "bg-[#2e7d74]" : "bg-ink-600"}`}
    >
      <span className={`absolute top-[3px] h-3 w-3 rounded-full bg-bone transition-all ${on ? "left-[18px]" : "left-[3px]"}`} />
    </button>
  );
}

function Slider({ value, set, min, max, step = 1, unit = "" }: { value: number; set: (v: number) => void; min: number; max: number; step?: number; unit?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="h-1 w-32 cursor-pointer appearance-none rounded-full bg-ink-600 accent-[#d5482f]"
      />
      <span className="w-14 text-right font-mono text-[10.5px] text-bone-dim">
        {value}
        {unit}
      </span>
    </span>
  );
}

function Seg<T extends string>({ value, set, opts }: { value: T; set: (v: T) => void; opts: [T, string][] }) {
  return (
    <span className="flex rounded-md bg-[#0b0d10] p-0.5">
      {opts.map(([v, label]) => (
        <button
          key={v}
          onClick={() => set(v)}
          className={`rounded px-2.5 py-1 text-[11px] transition-colors ${value === v ? "bg-[#d5482f] text-[#f5f1e8]" : "text-mute hover:text-bone"}`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

function Sel({ value, set, opts }: { value: string; set: (v: string) => void; opts: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => set(e.target.value)}
      className="rounded border border-white/10 bg-[#1a2028] px-2 py-1.5 text-[11.5px] text-bone outline-none focus:border-[#d5482f]/60"
    >
      {opts.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Chips({ values, set, placeholder }: { values: string[]; set: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || values.includes(v)) return setDraft("");
    set([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex max-w-md flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className="group flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] text-bone-dim">
          {v}
          <button onClick={() => set(values.filter((x) => x !== v))} className="text-ink-500 transition-colors hover:text-[#ef6a4c]">
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
        placeholder={placeholder}
        className="w-28 rounded border border-dashed border-white/15 bg-transparent px-2 py-1 font-mono text-[10.5px] text-bone outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
      />
      <button onClick={add} className="rounded p-1 text-mute transition-colors hover:bg-white/5 hover:text-bone" title="添加">
        <IconPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function KeyCap({ combo, set }: { combo: string; set: (v: string) => void }) {
  const [cap, setCap] = useState(false);
  useEffect(() => {
    if (!cap) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setCap(false);
      const c = comboFromEvent(e);
      if (c) {
        set(c);
        setCap(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [cap, set]);
  return (
    <button
      onClick={() => setCap(true)}
      className={`min-w-[108px] rounded border px-3 py-1.5 font-mono text-[11px] transition-colors ${
        cap ? "border-[#d5482f] bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/15 bg-[#0b0d10] text-bone-dim hover:border-white/30 hover:text-bone"
      }`}
    >
      {cap ? "按下组合键… (Esc 取消)" : combo}
    </button>
  );
}

/* ============ live demos ============ */
const CUES = [
  { t0: 0, t1: 4, en: "Welcome back to The Reading Room.", zh: "欢迎回到《阅览室》。" },
  { t0: 4, t1: 8, en: "Today: why deep reading still matters.", zh: "今天的话题：深度阅读为何仍然重要。" },
  { t0: 8, t1: 13, en: "We follow Ana Reyes through one evening.", zh: "我们将跟随安娜·雷耶斯度过一个夜晚。" },
  { t0: 13, t1: 18, en: "Grab a tea, and turn on bilingual subtitles.", zh: "泡杯茶，打开双语字幕。" },
  { t0: 18, t1: 24, en: "Credits roll — see you next episode.", zh: "片尾滚动——下集见。" },
];

function SubtitleDemo() {
  const { s } = useSettings();
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setT((v) => (v + 0.1 >= 24 ? 0 : v + 0.1)), 100);
    return () => window.clearInterval(id);
  }, [playing]);
  const cue = CUES.find((c) => t >= c.t0 && t < c.t1);
  const sub = s.subs;
  return (
    <div className="relative aspect-video overflow-hidden rounded-md border border-white/10 bg-[#0b0d10]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#232b35_0%,#0b0d10_70%)]" />
      <div className="absolute left-4 top-3 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">
        subtitle preview · {sub.engine}
      </div>
      {!sub.enabled && (
        <div className="absolute inset-0 grid place-items-center bg-[#0b0d10]/70">
          <p className="font-mono text-[11px] text-mute">字幕翻译已关闭</p>
        </div>
      )}
      <button
        onClick={() => setPlaying(!playing)}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-3 text-bone transition-all hover:scale-110 hover:bg-white/10"
        title={playing ? "暂停" : "播放"}
      >
        {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
      </button>
      {sub.enabled && cue && (
        <div
          className={`absolute inset-x-0 flex flex-col items-center gap-1 px-4 ${sub.position === "below" ? "bottom-8" : "top-8"}`}
          style={{ fontSize: sub.size }}
        >
          {sub.position === "below" ? (
            <>
              <span className="leading-snug text-bone/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{cue.en}</span>
              <span
                className="font-display leading-snug text-[#f5f1e8]"
                style={{ background: `rgba(11,13,16,${sub.bgOpacity / 100})`, padding: "1px 8px", borderRadius: 3 }}
              >
                {cue.zh}
              </span>
            </>
          ) : (
            <>
              <span
                className="font-display leading-snug text-[#f5f1e8]"
                style={{ background: `rgba(11,13,16,${sub.bgOpacity / 100})`, padding: "1px 8px", borderRadius: 3 }}
              >
                {cue.zh}
              </span>
              <span className="leading-snug text-bone/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{cue.en}</span>
            </>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
        <div className="h-full bg-[#d5482f] transition-[width] duration-100" style={{ width: `${(t / 24) * 100}%` }} />
      </div>
      <span className="absolute bottom-2 right-3 font-mono text-[9px] text-ink-500">{t.toFixed(1)}s / 24s</span>
    </div>
  );
}

function ComicDemo() {
  const { s } = useSettings();
  const [done, setDone] = useState(s.comic.enabled);
  useEffect(() => setDone(s.comic.enabled), [s.comic.enabled]);
  const c = s.comic;
  const bubbleFill = c.bg === "white" ? "#ffffff" : c.bg === "paper" ? "#f5f1e8" : "#e8e2d4";
  const det = c.enabled ? c.confidence / 100 : 0;
  const vStyle = c.typeset === "vertical" ? ({ writingMode: "vertical-rl" } as const) : undefined;
  return (
    <div className="overflow-hidden rounded-md border border-white/10">
      <svg viewBox="0 0 340 200" className="block w-full bg-[#f5f1e8]">
        <rect x="6" y="6" width="328" height="188" fill="none" stroke="#22262c" strokeWidth="2.5" />
        {[...Array(9)].map((_, i) => (
          <line key={i} x1={20 + i * 34} y1="6" x2={-10 + i * 34} y2="194" stroke="#22262c" strokeWidth="0.7" opacity="0.14" />
        ))}
        <circle cx="238" cy="128" r="34" fill="#22262c" opacity="0.08" />
        <path d="M214 168c4-26 14-40 26-40s22 14 26 40z" fill="#22262c" opacity="0.75" />
        <circle cx="240" cy="112" r="15" fill="#22262c" opacity="0.75" />
        {/* bubble 1 */}
        <ellipse cx="102" cy="66" rx="72" ry="38" fill={bubbleFill} stroke="#22262c" strokeWidth="2" />
        <path d="M128 98l10 18 4-20z" fill={bubbleFill} stroke="#22262c" strokeWidth="2" />
        {done ? (
          <text x="102" y="58" textAnchor="middle" fontSize="13" fontWeight="700" fill="#22262c" fontFamily="'Noto Serif SC',serif" style={vStyle}>
            <tspan x="102" dy="0">我书页边的批注</tspan>
            <tspan x="102" dy="17">比日记更诚实！</tspan>
          </text>
        ) : (
          <text x="102" y="58" textAnchor="middle" fontSize="11" fontWeight="700" fill="#22262c" style={vStyle}>
            <tspan x="102" dy="0">The margins of my books</tspan>
            <tspan x="102" dy="15">are more honest</tspan>
            <tspan x="102" dy="15">than my diary!</tspan>
          </text>
        )}
        {/* bubble 2 */}
        <rect x="216" y="30" width="102" height="46" rx="10" fill={bubbleFill} stroke="#22262c" strokeWidth="2" />
        <path d="M240 76l-6 16 14-14z" fill={bubbleFill} stroke="#22262c" strokeWidth="2" />
        {done ? (
          <text x="267" y="50" textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#22262c" fontFamily="'Noto Serif SC',serif" style={vStyle}>
            也翻译我……
          </text>
        ) : (
          <text x="267" y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill="#22262c" style={vStyle}>
            Translate me too…
          </text>
        )}
        {/* detection overlay */}
        <g opacity={det} style={{ transition: "opacity .4s" }}>
          <rect x="26" y="24" width="152" height="86" fill="none" stroke="#d5482f" strokeWidth="1.4" strokeDasharray="5 4" />
          <rect x="212" y="26" width="110" height="54" fill="none" stroke="#d5482f" strokeWidth="1.4" strokeDasharray="5 4" />
          <rect x="26" y="12" width="72" height="13" fill="#d5482f" />
          <text x="30" y="22" fontSize="9" fill="#f5f1e8" fontFamily="'IBM Plex Mono',monospace">
            bubble {Math.round(88 + det * 9)}%
          </text>
        </g>
      </svg>
      <div className="flex items-center justify-between border-t border-white/10 bg-[#141920] px-3 py-2">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-mute">manga inpaint preview</p>
        <button
          onClick={() => setDone(!done)}
          className="rounded border border-white/15 px-2.5 py-1 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-[#d5482f]/60 hover:text-[#ef6a4c]"
        >
          {done ? "还原原文气泡" : "翻译本页漫画"}
        </button>
      </div>
    </div>
  );
}

/* ============ page ============ */
const SECTIONS = [
  ["basic", "基本设置", <IconGlobe key="i" />],
  ["services", "翻译服务", <IconRoute key="i" />],
  ["ai", "AI 专家", <IconBot key="i" />],
  ["terms", "术语库", <IconBook key="i" />],
  ["subs", "字幕", <IconCaption key="i" />],
  ["comic", "漫画 / 图片", <IconImage key="i" />],
  ["input", "输入框", <IconInput key="i" />],
  ["select", "划词", <IconSelect key="i" />],
  ["hover", "悬停", <IconHover key="i" />],
  ["ball", "悬浮球", <IconBall key="i" />],
  ["keys", "快捷键", <IconKeyboard key="i" />],
  ["adv", "进阶", <IconGear key="i" />],
  ["data", "数据", <IconDb key="i" />],
  ["about", "关于", <IconInfo key="i" />],
] as const;

type SecId = (typeof SECTIONS)[number][0];

export default function SettingsPage({
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
  const { s, set, log, clearLog, stats, resetAll, importJson, pushLog } = useSettings();
  const [active, setActive] = useState<SecId>("basic");
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [testState, setTestState] = useState<"idle" | "run" | "ok" | "err">("idle");
  const [testMs, setTestMs] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importTxt, setImportTxt] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [upd, setUpd] = useState<"idle" | "run" | "done">("idle");

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id.replace("sec-", "") as SecId)),
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = (id: SecId) => {
    refs.current[id]?.scrollIntoView({ block: "start", behavior: "smooth" });
    setActive(id);
  };

  const runTest = async () => {
    setTestState("run");
    const t0 = performance.now();
    try {
      await translate("connection test", s.basic.target, "auto");
      setTestMs(Math.round(performance.now() - t0));
      setTestState("ok");
      pushLog(`连接测试通过 · ${Math.round(performance.now() - t0)}ms`, "ok");
    } catch {
      setTestState("err");
      pushLog("连接测试失败 · 网络或 CORS 不可达", "err");
    }
  };

  /* 稳定组件类型：避免父级重渲染导致各设置卡片（及其演示）被卸载重建 */
  const cardImpl = useRef<
    ((p: { id: SecId; title: string; desc: string; icon: ReactNode; children: ReactNode }) => ReactNode) | null
  >(null);
  if (cardImpl.current === null) {
    cardImpl.current = function CardImpl({ id, title, desc, icon, children }) {
      return (
        <section
          id={`sec-${id}`}
          ref={(el) => {
            refs.current[id] = el;
          }}
          className="scroll-mt-4 rounded-lg border border-white/10 bg-[#10141a]/80 p-5"
        >
          <div className="mb-3 flex items-center gap-3 border-b border-white/5 pb-3">
            <span className="text-[#ef6a4c]">{icon}</span>
            <h3 className="font-display text-[16px] font-bold text-bone">{title}</h3>
            <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">{id}</span>
          </div>
          <p className="mb-2 -mt-1 text-[11.5px] leading-relaxed text-mute">{desc}</p>
          {children}
        </section>
      );
    };
  }
  const Card = cardImpl.current;

  const comboDup =
    s.keys.togglePage === s.keys.openPanel || s.keys.togglePage === s.keys.toggleSide || s.keys.openPanel === s.keys.toggleSide;

  return (
    <div className="grid gap-5 px-5 py-6 md:grid-cols-[168px_1fr] md:px-8">
      {/* nav */}
      <nav className="top-4 hidden self-start md:sticky md:block">
        <div className="mb-3 flex items-center gap-2 px-2">
          <Logo className="h-6 w-6 text-bone" />
          <div className="leading-none">
            <p className="font-display text-[12.5px] font-black text-bone">设置</p>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-mute">options · v1.2.0</p>
          </div>
        </div>
        <ul className="space-y-0.5">
          {SECTIONS.map(([id, label, icon]) => (
            <li key={id}>
              <button
                onClick={() => go(id)}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-all ${
                  active === id ? "bg-[#d5482f]/15 text-[#ef6a4c]" : "text-mute hover:bg-white/5 hover:text-bone-dim"
                }`}
              >
                <span className={active === id ? "" : "opacity-70"}>{icon}</span>
                {label}
                {active === id && <span className="ml-auto h-1 w-1 rounded-full bg-[#ef6a4c]" />}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* mobile nav */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[10.5px] transition-colors ${
              active === id ? "border-[#d5482f]/70 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 text-mute"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* 基本设置 */}
        <Card id="basic" title="基本设置" desc="界面语言、目标语言与双语版式。改动即时作用于演示窗口。" icon={<IconGlobe />}>
          <Row label="界面语言">
            <Sel value={s.basic.uiLang} set={(v) => set("basic", { uiLang: v as Settings["basic"]["uiLang"] })} opts={[["zh-CN", "简体中文"], ["en", "English"]]} />
          </Row>
          <Row label="自动检测源语言" hint="关闭后仅翻译「总是翻译」列表中的语言">
            <Tgl on={s.basic.sourceAuto} set={(v) => set("basic", { sourceAuto: v })} />
          </Row>
          <Row label="目标语言">
            <Sel value={s.basic.target} set={(v) => set("basic", { target: v as Settings["basic"]["target"] })} opts={TARGETS.map((t) => [t.code, t.label] as [string, string])} />
          </Row>
          <Row label="默认显示模式">
            <Seg value={mode} set={setMode} opts={[["bilingual", "双语对照"], ["only", "仅译文"], ["source", "原文"]]} />
          </Row>
          <Row label="译文位置">
            <Seg value={s.basic.position} set={(v) => set("basic", { position: v })} opts={[["below", "原文下方"], ["above", "原文上方"]]} />
          </Row>
          <Row label="译文字号">
            <Slider value={s.basic.fontSize} set={(v) => set("basic", { fontSize: v })} min={12} max={20} unit="px" />
          </Row>
          <Row label="译文样式" hint="与功能矩阵 Style Lab 共享同一状态">
            <Seg
              value={style.color}
              set={(v) => setStyle({ ...style, color: v })}
              opts={[["jade", "黛青"], ["cinnabar", "朱砂"], ["ink", "墨灰"], ["gold", "赭金"]]}
            />
          </Row>
          <Row label="总是翻译这些语言" stack>
            <Chips values={s.basic.alwaysLangs} set={(v) => set("basic", { alwaysLangs: v })} placeholder="如 Deutsch" />
          </Row>
          <Row label="永不翻译这些站点" stack>
            <Chips values={s.basic.neverSites} set={(v) => set("basic", { neverSites: v })} placeholder="如 example.com" />
          </Row>
        </Card>

        {/* 翻译服务 */}
        <Card id="services" title="翻译服务" desc="文本引擎路由、AI 引擎与密钥。演示环境中密钥仅存于本地。" icon={<IconRoute />}>
          <Row label="默认文本引擎" hint="谷歌（免费开箱即用）/ DeepL / 微软 / OpenAI 兼容 / Ollama">
            <Sel
              value={s.services.route}
              set={(v) => set("services", { route: v as Settings["services"]["route"] })}
              opts={[["auto", "自动路由"], ["google", "Google"], ["deepl", "DeepL"]]}
            />
          </Row>
          <Row label="默认 AI 引擎">
            <Sel
              value={s.services.aiEngine}
              set={(v) => set("services", { aiEngine: v })}
              opts={[["OpenAI 兼容", "OpenAI 兼容"], ["DeepSeek", "DeepSeek"], ["Ollama", "Ollama 本地模型"], ["DeepL", "DeepL"]]}
            />
          </Row>
          <Row label="并发请求数">
            <Slider value={s.services.concurrency} set={(v) => set("services", { concurrency: v })} min={1} max={10} />
          </Row>
          <Row label="请求间隔">
            <Slider value={s.services.interval} set={(v) => set("services", { interval: v })} min={0} max={1000} step={50} unit="ms" />
          </Row>
          <Row label="DeepL API Key">
            <input
              type="password"
              value={s.services.keys.deepl}
              onChange={(e) => set("services", { keys: { ...s.services.keys, deepl: e.target.value } })}
              placeholder="xxxx:fx:xxxx"
              className="w-44 rounded border border-white/10 bg-[#0b0d10] px-2 py-1.5 font-mono text-[11px] text-bone outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
            />
          </Row>
          <Row label="OpenAI API Key">
            <input
              type="password"
              value={s.services.keys.openai}
              onChange={(e) => set("services", { keys: { ...s.services.keys, openai: e.target.value } })}
              placeholder="sk-…"
              className="w-44 rounded border border-white/10 bg-[#0b0d10] px-2 py-1.5 font-mono text-[11px] text-bone outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
            />
          </Row>
          <Row label="连接测试" hint="向当前翻译服务发起一次真实请求">
            <span className="flex items-center gap-2">
              {testState === "ok" && <span className="font-mono text-[10.5px] text-[#57a79b]">通过 · {testMs}ms</span>}
              {testState === "err" && <span className="font-mono text-[10.5px] text-[#ef6a4c]">不可达</span>}
              <button
                onClick={runTest}
                disabled={testState === "run"}
                className="rounded border border-white/15 px-3 py-1.5 font-mono text-[11px] text-bone-dim transition-colors hover:border-[#57a79b]/60 hover:text-[#57a79b] disabled:opacity-50"
              >
                {testState === "run" ? "测试中…" : "发起测试"}
              </button>
            </span>
          </Row>
        </Card>

        {/* AI 专家 */}
        <Card id="ai" title="AI 专家" desc="为 AI 引擎预设人格与系统提示词；术语表会自动并入提示词。" icon={<IconBot />}>
          <Row label="启用 AI 专家润色">
            <Tgl on={s.ai.enabled} set={(v) => set("ai", { enabled: v })} />
          </Row>
          <div className="grid gap-2 py-3 sm:grid-cols-2">
            {EXPERTS.map((e) => (
              <button
                key={e.id}
                onClick={() => set("ai", { expert: e.id, prompt: e.prompt })}
                className={`rounded-md border p-3 text-left transition-all hover:-translate-y-0.5 ${
                  s.ai.expert === e.id ? "border-[#d5482f]/70 bg-[#d5482f]/10" : "border-white/10 hover:border-white/25"
                }`}
              >
                <p className="flex items-center gap-2 font-display text-[13px] font-bold text-bone">
                  {s.ai.expert === e.id && <IconCheck className="h-3.5 w-3.5 text-[#ef6a4c]" />}
                  {e.name}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-mute">{e.desc}</p>
              </button>
            ))}
          </div>
          <Row label="温度 temperature">
            <Slider value={s.ai.temperature} set={(v) => set("ai", { temperature: v })} min={0} max={1} step={0.1} />
          </Row>
          <Row label="系统提示词" stack>
            <textarea
              rows={3}
              value={s.ai.prompt}
              onChange={(e) => set("ai", { prompt: e.target.value })}
              className="w-full resize-y rounded border border-white/10 bg-[#0b0d10] px-3 py-2 text-[12px] leading-relaxed text-bone outline-none focus:border-[#d5482f]/60"
            />
          </Row>
          <pre className="mt-2 overflow-x-auto rounded border border-white/5 bg-[#0b0d10] p-3 font-mono text-[10px] leading-relaxed text-ink-500">
            {`[system] ${s.ai.prompt}\n[target] ${s.basic.target} · temp=${s.ai.temperature}\n[glossary] ${
              s.terms.enabled ? s.terms.list.map((t) => `${t.src}→${t.dst}`).join(" | ") || "（空）" : "（已停用）"
            }`}
          </pre>
        </Card>

        {/* 术语库 */}
        <Card id="terms" title="术语库" desc="句级替换，实时作用于演示窗口的一切译文（含划词与输入框）。" icon={<IconBook />}>
          <Row label="启用术语替换">
            <Tgl on={s.terms.enabled} set={(v) => set("terms", { enabled: v })} />
          </Row>
          <div className="space-y-1.5 py-3">
            {s.terms.list.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-1.5">
                <input
                  value={t.src}
                  onChange={(e) => {
                    const list = [...s.terms.list];
                    list[i] = { ...t, src: e.target.value };
                    set("terms", { list });
                  }}
                  className="w-36 rounded border border-white/10 bg-[#0b0d10] px-2 py-1 font-mono text-[11px] text-bone-dim outline-none focus:border-[#d5482f]/60"
                />
                <span className="text-mute">→</span>
                <input
                  value={t.dst}
                  onChange={(e) => {
                    const list = [...s.terms.list];
                    list[i] = { ...t, dst: e.target.value };
                    set("terms", { list });
                  }}
                  className="w-32 rounded border border-white/10 bg-[#0b0d10] px-2 py-1 text-[11.5px] text-bone outline-none focus:border-[#d5482f]/60"
                />
                <input
                  value={t.dom}
                  onChange={(e) => {
                    const list = [...s.terms.list];
                    list[i] = { ...t, dom: e.target.value };
                    set("terms", { list });
                  }}
                  className="w-24 rounded border border-dashed border-white/10 bg-transparent px-2 py-1 font-mono text-[10px] text-mute outline-none focus:border-white/30"
                />
                <button
                  onClick={() => set("terms", { list: s.terms.list.filter((x) => x.id !== t.id) })}
                  className="rounded p-1 text-ink-500 transition-colors hover:bg-white/5 hover:text-[#ef6a4c]"
                  title="删除该术语"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => set("terms", { list: [...s.terms.list, { id: Date.now(), src: "", dst: "", dom: "自定义" }] })}
              className="flex items-center gap-1.5 rounded border border-dashed border-white/15 px-2.5 py-1 font-mono text-[10.5px] text-mute transition-colors hover:border-[#d5482f]/60 hover:text-[#ef6a4c]"
            >
              <IconPlus className="h-3 w-3" /> 新增术语
            </button>
          </div>
          <button
            onClick={async () => {
              const ok = await copyText(JSON.stringify(s.terms.list, null, 2));
              pushLog(ok ? "术语表已导出到剪贴板" : "导出失败", ok ? "ok" : "err");
            }}
            className="flex items-center gap-1.5 font-mono text-[10.5px] text-mute underline underline-offset-2 hover:text-bone"
          >
            <IconCopy className="h-3 w-3" /> 导出 JSON 到剪贴板
          </button>
        </Card>

        {/* 字幕 */}
        <Card id="subs" title="字幕" desc="YouTube / Netflix 双语字幕的版式与预览播放器。" icon={<IconCaption />}>
          <Row label="启用字幕翻译">
            <Tgl on={s.subs.enabled} set={(v) => set("subs", { enabled: v })} />
          </Row>
          <Row label="字幕引擎">
            <Sel value={s.subs.engine} set={(v) => set("subs", { engine: v })} opts={[["Google", "Google"], ["DeepL", "DeepL"], ["OpenAI 兼容", "OpenAI 兼容"], ["Ollama", "Ollama"]]} />
          </Row>
          <Row label="译文位置">
            <Seg value={s.subs.position} set={(v) => set("subs", { position: v })} opts={[["below", "原文下方"], ["above", "原文上方"]]} />
          </Row>
          <Row label="字号">
            <Slider value={s.subs.size} set={(v) => set("subs", { size: v })} min={12} max={22} unit="px" />
          </Row>
          <Row label="背景不透明度" stack>
            <Slider value={s.subs.bgOpacity} set={(v) => set("subs", { bgOpacity: v })} min={0} max={100} step={5} unit="%" />
          </Row>
          <div className="pt-3">
            <SubtitleDemo />
          </div>
        </Card>

        {/* 漫画 / 图片 */}
        <Card id="comic" title="漫画 / 图片" desc="气泡检测、擦除回填与重排版的实时预览。" icon={<IconImage />}>
          <Row label="启用图片内翻译">
            <Tgl on={s.comic.enabled} set={(v) => set("comic", { enabled: v })} />
          </Row>
          <Row label="气泡检测置信度阈值" hint="低于阈值的气泡不处理；预览中虚线框透明度随之变化">
            <Slider value={s.comic.confidence} set={(v) => set("comic", { confidence: v })} min={30} max={99} unit="%" />
          </Row>
          <Row label="擦除回填底色">
            <Sel value={s.comic.bg} set={(v) => set("comic", { bg: v as Settings["comic"]["bg"] })} opts={[["paper", "纸色"], ["white", "纯白"], ["auto", "自动取色"]]} />
          </Row>
          <Row label="排版方向">
            <Seg value={s.comic.typeset} set={(v) => set("comic", { typeset: v })} opts={[["auto", "横排"], ["vertical", "竖排"]]} />
          </Row>
          <div className="pt-3">
            <ComicDemo />
          </div>
        </Card>

        {/* 输入框 */}
        <Card id="input" title="输入框" desc="在任意输入框把所写内容原地翻译。去演示窗口评论区试试。" icon={<IconInput />}>
          <Row label="启用输入框翻译">
            <Tgl on={s.input.enabled} set={(v) => set("input", { enabled: v })} />
          </Row>
          <Row label="触发方式">
            <Seg value={s.input.trigger} set={(v) => set("input", { trigger: v })} opts={[["space3", "三次空格"], ["ctrlEnter", "Ctrl+Enter"], ["both", "两者皆可"]]} />
          </Row>
          <Row label="最短触发长度">
            <Slider value={s.input.minLen} set={(v) => set("input", { minLen: v })} min={1} max={20} unit="字" />
          </Row>
          <Row label="黑名单字段（name/id 含）" stack>
            <Chips values={s.input.blacklist} set={(v) => set("input", { blacklist: v })} placeholder="如 token" />
          </Row>
        </Card>

        {/* 划词 */}
        <Card id="select" title="划词" desc="拖选正文弹出浮动气泡；图标模式需再点一次小图标。" icon={<IconSelect />}>
          <Row label="启用划词翻译">
            <Tgl on={s.select.enabled} set={(v) => set("select", { enabled: v })} />
          </Row>
          <Row label="触发模式">
            <Seg value={s.select.mode} set={(v) => set("select", { mode: v })} opts={[["auto", "选区即弹气泡"], ["icon", "先显示图标"]]} />
          </Row>
          <Row label="最少字符数">
            <Slider value={s.select.minChars} set={(v) => set("select", { minChars: v })} min={2} max={20} unit="字" />
          </Row>
          <Row label="译文自动复制" hint="气泡出现即写入剪贴板">
            <Tgl on={s.select.autoCopy} set={(v) => set("select", { autoCopy: v })} />
          </Row>
        </Card>

        {/* 悬停 */}
        <Card id="hover" title="悬停" desc="原文模式下掠过段落的试译预览，可加修饰键防误触。" icon={<IconHover />}>
          <Row label="启用悬停试译">
            <Tgl on={s.hover.enabled} set={(v) => set("hover", { enabled: v })} />
          </Row>
          <Row label="悬停延迟">
            <Slider value={s.hover.delay} set={(v) => set("hover", { delay: v })} min={100} max={1500} step={50} unit="ms" />
          </Row>
          <Row label="需要按住">
            <Seg value={s.hover.modifier} set={(v) => set("hover", { modifier: v })} opts={[["none", "无"], ["alt", "Alt"], ["ctrl", "Ctrl"]]} />
          </Row>
        </Card>

        {/* 悬浮球 */}
        <Card id="ball" title="悬浮球" desc="注入网页的悬浮球：位置、大小、透明度与点击行为，演示窗口实时同步。" icon={<IconBall />}>
          <Row label="显示悬浮球">
            <Tgl on={s.ball.enabled} set={(v) => set("ball", { enabled: v })} />
          </Row>
          <Row label="停靠位置">
            <Sel
              value={s.ball.pos}
              set={(v) => set("ball", { pos: v as Settings["ball"]["pos"] })}
              opts={[["rb", "右下"], ["rm", "右中"], ["lb", "左下"], ["lm", "左中"]]}
            />
          </Row>
          <Row label="直径">
            <Slider value={s.ball.size} set={(v) => set("ball", { size: v })} min={40} max={72} step={2} unit="px" />
          </Row>
          <Row label="不透明度">
            <Slider value={s.ball.opacity} set={(v) => set("ball", { opacity: v })} min={30} max={100} step={2} unit="%" />
          </Row>
          <Row label="允许拖拽">
            <Tgl on={s.ball.drag} set={(v) => set("ball", { drag: v })} />
          </Row>
          <Row label="单击行为">
            <Seg value={s.ball.click} set={(v) => set("ball", { click: v })} opts={[["panel", "打开快捷面板"], ["translate", "直接翻译本页"]]} />
          </Row>
        </Card>

        {/* 快捷键 */}
        <Card id="keys" title="快捷键" desc="点击胶囊后按下新组合键即可重绑定；Esc 取消。" icon={<IconKeyboard />}>
          <Row label="翻译 / 收起本页">
            <KeyCap combo={s.keys.togglePage} set={(v) => set("keys", { togglePage: v })} />
          </Row>
          <Row label="打开快捷面板">
            <KeyCap combo={s.keys.openPanel} set={(v) => set("keys", { openPanel: v })} />
          </Row>
          <Row label="开关侧边栏">
            <KeyCap combo={s.keys.toggleSide} set={(v) => set("keys", { toggleSide: v })} />
          </Row>
          {comboDup && (
            <p className="py-2 font-mono text-[10.5px] text-[#ef6a4c]">⚠ 存在重复组合键，后绑定者将失效</p>
          )}
          <button
            onClick={() => set("keys", { ...DEFAULTS.keys })}
            className="mt-2 rounded border border-white/15 px-3 py-1.5 font-mono text-[10.5px] text-mute transition-colors hover:border-white/30 hover:text-bone"
          >
            恢复默认快捷键
          </button>
        </Card>

        {/* 进阶 */}
        <Card id="adv" title="进阶" desc="注入自定义 CSS、缓存与调试。CSS 会实时注入演示页面。" icon={<IconGear />}>
          <Row label="自定义 CSS" hint="作用于演示页面，选择器可用 .ir-page / .ir-trans" stack>
            <textarea
              rows={4}
              value={s.adv.css}
              onChange={(e) => set("adv", { css: e.target.value })}
              placeholder={".ir-trans { letter-spacing: .04em; }\n.ir-page blockquote { background: #ece6d8; }"}
              className="w-full resize-y rounded border border-white/10 bg-[#0b0d10] px-3 py-2 font-mono text-[11px] leading-relaxed text-bone-dim outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
            />
          </Row>
          <div className="flex gap-2 py-2">
            <button
              onClick={() => set("adv", { css: ".ir-trans { letter-spacing: .06em; text-shadow: 0 0 12px rgba(46,125,116,.25); }" })}
              className="rounded border border-white/15 px-2.5 py-1 font-mono text-[10.5px] text-mute transition-colors hover:border-[#57a79b]/60 hover:text-[#57a79b]"
            >
              填入示例：译文辉光
            </button>
            <button
              onClick={() => set("adv", { css: "" })}
              className="rounded border border-white/15 px-2.5 py-1 font-mono text-[10.5px] text-mute transition-colors hover:border-white/30 hover:text-bone"
            >
              清空
            </button>
          </div>
          <Row label="译文缓存有效期">
            <Sel value={String(s.adv.cacheTTL)} set={(v) => set("adv", { cacheTTL: Number(v) })} opts={[["1", "1 天"], ["7", "7 天"], ["30", "30 天"], ["0", "永久"]]} />
          </Row>
          <Row label="调试日志" hint="在侧边栏「历史」与数据页记录每次引擎调用">
            <Tgl on={s.adv.debug} set={(v) => set("adv", { debug: v })} />
          </Row>
          <Row label="实验特性" hint="竖排漫画排版、段落级流式输出等">
            <Tgl on={s.adv.experimental} set={(v) => set("adv", { experimental: v })} />
          </Row>
        </Card>

        {/* 数据 */}
        <Card id="data" title="数据" desc="本次会话的用量、导出导入与重置。" icon={<IconDb />}>
          <div className="grid grid-cols-2 gap-2 py-3 sm:grid-cols-4">
            {[
              [stats.chars.toLocaleString(), "已译字符"],
              [String(stats.reqs), "请求次数"],
              [String(log.length), "日志条目"],
              [`${(JSON.stringify(s).length / 1024).toFixed(1)}KB`, "配置体积"],
            ].map(([k, v]) => (
              <div key={v} className="rounded-md border border-white/5 bg-[#0b0d10] p-3">
                <p className="font-display text-[19px] font-black leading-none text-bone">{k}</p>
                <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-mute">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 py-2">
            <button
              onClick={async () => {
                const ok = await copyText(JSON.stringify(s, null, 2));
                setCopied(ok);
                pushLog(ok ? "设置已导出到剪贴板" : "导出失败", ok ? "ok" : "err");
                window.setTimeout(() => setCopied(false), 1600);
              }}
              className="flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-[#57a79b]/60 hover:text-[#57a79b]"
            >
              {copied ? <IconCheck className="h-3.5 w-3.5" /> : <IconCopy className="h-3.5 w-3.5" />} 导出设置
            </button>
            <button
              onClick={() => setImportOpen(!importOpen)}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-white/30 hover:text-bone"
            >
              导入设置
            </button>
            <button
              onClick={clearLog}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-white/30 hover:text-bone"
            >
              清空运行日志
            </button>
            <button
              onClick={() => {
                if (!confirmReset) {
                  setConfirmReset(true);
                  window.setTimeout(() => setConfirmReset(false), 2600);
                  return;
                }
                resetAll();
                setConfirmReset(false);
                pushLog("已恢复全部默认设置", "ok");
              }}
              className={`rounded border px-3 py-1.5 font-mono text-[10.5px] transition-colors ${
                confirmReset ? "border-[#d5482f] bg-[#d5482f]/20 text-[#ef6a4c]" : "border-white/15 text-bone-dim hover:border-[#d5482f]/60 hover:text-[#ef6a4c]"
              }`}
            >
              {confirmReset ? "再点一次确认重置！" : "重置所有设置"}
            </button>
          </div>
          {importOpen && (
            <div className="space-y-2 pt-1">
              <textarea
                rows={4}
                value={importTxt}
                onChange={(e) => setImportTxt(e.target.value)}
                placeholder='粘贴导出的 JSON，如 {"basic":{"target":"ja"}}'
                className="w-full resize-y rounded border border-white/10 bg-[#0b0d10] px-3 py-2 font-mono text-[11px] text-bone-dim outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
              />
              {importErr && <p className="font-mono text-[10.5px] text-[#ef6a4c]">{importErr}</p>}
              <button
                onClick={() => {
                  const err = importJson(importTxt);
                  setImportErr(err);
                  if (!err) {
                    pushLog("设置已从 JSON 导入", "ok");
                    setImportOpen(false);
                    setImportTxt("");
                  }
                }}
                className="rounded bg-[#d5482f] px-3 py-1.5 font-mono text-[10.5px] text-[#f5f1e8] transition-colors hover:bg-[#ef6a4c]"
              >
                应用导入
              </button>
            </div>
          )}
        </Card>

        {/* 关于 */}
        <Card id="about" title="关于" desc="概念构建信息、致谢与许可。" icon={<IconInfo />}>
          <div className="flex items-center gap-4 py-3">
            <Logo className="h-12 w-12 text-bone" />
            <div>
              <p className="font-display text-[17px] font-black text-bone">AI 沉浸翻译 · translate-ext</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">open source · v1.2.0 · manifest v3</p>
            </div>
          </div>
          <Row label="检查更新">
            <span className="flex items-center gap-2">
              {upd === "done" && <span className="font-mono text-[10.5px] text-[#57a79b]">已是最新 v1.2.0</span>}
              <button
                onClick={() => {
                  setUpd("run");
                  window.setTimeout(() => {
                    setUpd("done");
                    pushLog("检查更新：已是最新 v1.2.0", "ok");
                  }, 1300);
                }}
                disabled={upd === "run"}
                className="rounded border border-white/15 px-3 py-1.5 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-[#57a79b]/60 hover:text-[#57a79b] disabled:opacity-50"
              >
                {upd === "run" ? "检查中…" : "立即检查"}
              </button>
            </span>
          </Row>
          {upd === "run" && (
            <div className="my-2 h-1 overflow-hidden rounded-full bg-ink-700">
              <div className="h-full w-1/3 animate-[selSweep_1.3s_linear_infinite] bg-[#57a79b]" />
            </div>
          )}
          <div className="space-y-1.5 py-3 text-[11.5px] leading-relaxed text-mute">
            <p>· 本页为交互式介绍：模拟浏览器、弹窗、悬浮球、快捷面板、侧边栏与设置全部真实联动。</p>
            <p>· 本页为交互式介绍：模拟浏览器中的双语语料离线内置；真实扩展由浏览器直连你所配置的翻译服务。</p>
            <p>· 致敬所有让「另一种语言伸手可及」的开源译者与引擎。</p>
          </div>
          <pre className="overflow-x-auto rounded border border-white/5 bg-[#0b0d10] p-3 font-mono text-[9.5px] leading-relaxed text-ink-500">
            {`LICENSE · MIT\nCopyright (c) 2026 translate-ext\nPermission is hereby granted, free of charge, to any person\nobtaining a copy of this software…`}
          </pre>
        </Card>
      </div>
    </div>
  );
}


