import { useEffect, useState, type ReactNode } from "react";
import { Reveal, usePrefersReducedMotion } from "../hooks/useReveal";
import type { DisplayMode, TransStyle } from "../state/settings";
import { SectionHead } from "./Hero";
import {
  IconBilingual,
  IconHover,
  IconInput,
  IconRoute,
  IconSelect,
  IconShield,
  IconSliders,
} from "./Icons";

const CARD =
  "group relative overflow-hidden rounded-lg border border-white/10 bg-[#10141a]/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-[#141920]";

function CardTitle({ icon, t, d }: { icon: ReactNode; t: string; d: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 text-[#ef6a4c] transition-transform duration-300 group-hover:scale-110">{icon}</span>
      <div>
        <h3 className="font-display text-[16.5px] font-bold text-bone">{t}</h3>
        <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">{d}</p>
      </div>
    </div>
  );
}

export default function Features({
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
  const reduced = usePrefersReducedMotion();
  const [hoverCard, setHoverCard] = useState(false);
  const [activeEngine, setActiveEngine] = useState(0);
  const engines = ["Google 翻译", "DeepL", "微软 Azure", "OpenAI 兼容", "Ollama"];

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setActiveEngine((i) => (i + 1) % engines.length), 1900);
    return () => window.clearInterval(id);
  }, [reduced, engines.length]);

  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <SectionHead
        index="02 / features"
        title="七个表面，一种沉浸"
        desc="每个卡片都是一块真实工作的界面切片：悬停、点按、切换，都会立刻反映在上方模拟浏览器里。"
      />
      <div className="grid gap-4 md:grid-cols-6">
        {/* 双语对照 */}
        <Reveal className="md:col-span-3">
          <div className={CARD}>
            <CardTitle icon={<IconBilingual />} t="句级双语对照" d="bilingual · side by stack" />
            <div className="rounded-md border border-white/10 bg-[#f5f1e8] p-4">
              <p className="text-[13.5px] leading-relaxed text-[#22262c]">
                Bilingual pages refuse that trade-off, keeping the original line within reach of the translated one.
              </p>
              <div className="my-2.5 h-px origin-left scale-x-100 bg-[#d9d1bf] transition-transform duration-700 group-hover:scale-x-0" />
              <div className="my-2.5 h-px origin-left scale-x-0 bg-[#2e7d74] transition-transform duration-700 group-hover:scale-x-100" />
              <p className="font-display text-[13.5px] leading-relaxed text-[#2b6d64]">
                双语页面拒绝了这种取舍，让原文始终停留在译文伸手可及之处。
              </p>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
              段落级对齐而非整页替换：译文逐句 cascade 淡入，阅读节奏不被打断。
            </p>
          </div>
        </Reveal>

        {/* 悬停试译 */}
        <Reveal delay={60} className="md:col-span-3">
          <div className={CARD} onMouseEnter={() => setHoverCard(true)} onMouseLeave={() => setHoverCard(false)}>
            <CardTitle icon={<IconHover />} t="悬停试译" d="hover preview · 把鼠标放上来" />
            <div className="rounded-md border border-white/10 bg-[#0b0d10] p-4">
              <p className="text-[13.5px] leading-relaxed text-bone-dim">
                The margins of my books are more honest than my diary.
              </p>
              <div
                className={`overflow-hidden transition-all duration-500 ${
                  hoverCard ? "mt-2 max-h-20 opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <p className="border-l-2 border-[#2e7d74] pl-3 font-display text-[13.5px] leading-relaxed text-[#57a79b]">
                  我书页边空白处的批注，比我的日记更诚实。
                </p>
              </div>
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
              原文模式下鼠标掠过段落即浮现译文，移开即隐；点击段侧图钉可永久固定某段。
            </p>
          </div>
        </Reveal>

        {/* 输入框 */}
        <Reveal delay={90} className="md:col-span-2">
          <div className={CARD}>
            <CardTitle icon={<IconInput />} t="输入框翻译" d="triple space" />
            <div className="flex items-center gap-1.5">
              {["␣", "", ""].map((k, i) => (
                <span
                  key={i}
                  className="space-key flex h-9 flex-1 items-center justify-center rounded border border-white/10 font-mono text-[13px]"
                  style={{ animationDelay: `${i * 260}ms` }}
                >
                  {k}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
              在任意输入框连按三次空格（或 Ctrl+Enter），所写内容原地变为译文——写邮件、发评论、提 issue 皆然。
            </p>
          </div>
        </Reveal>

        {/* 划词 */}
        <Reveal delay={120} className="md:col-span-2">
          <div className={CARD}>
            <CardTitle icon={<IconSelect />} t="划词浮译" d="selection bubble" />
            <div className="relative rounded border border-white/10 bg-[#0b0d10] p-3">
              <p className="text-[12.5px] leading-relaxed text-bone-dim">Follow a character through four hundred pages…</p>
              <span className="sel-sweep absolute left-3 top-[38px] h-[18px] rounded-sm bg-[#d5482f]/35" />
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
              拖选正文任意片段，气泡在选区下方展开；内置语料命中则离线秒出，否则直连在线引擎。
            </p>
          </div>
        </Reveal>

        {/* 隐私 */}
        <Reveal delay={150} className="md:col-span-2">
          <div className={CARD}>
            <CardTitle icon={<IconShield />} t="本地与直连" d="no middleman" />
            <ul className="space-y-2 font-mono text-[11px] text-bone-dim">
              {["请求由浏览器直发引擎", "无中转服务器 / 无账号", "文档本地解析不上传", "Ollama 可全离线"].map((t) => (
                <li key={t} className="flex items-center gap-2 transition-transform duration-300 group-hover:translate-x-1">
                  <span className="h-1 w-1 rounded-full bg-[#57a79b]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* 引擎路由 */}
        <Reveal delay={60} className="md:col-span-3">
          <div className={CARD}>
            <CardTitle icon={<IconRoute />} t="多引擎自动路由" d="engine router" />
            <ul className="space-y-1.5">
              {engines.map((e, i) => (
                <li
                  key={e}
                  className={`flex items-center justify-between rounded border px-3 py-1.5 font-mono text-[11.5px] transition-all duration-500 ${
                    activeEngine === i
                      ? "border-[#d5482f]/60 bg-[#d5482f]/10 text-[#ef6a4c]"
                      : "border-white/5 text-mute"
                  }`}
                >
                  {e}
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1 rounded-full transition-all duration-500 ${activeEngine === i ? "bg-[#ef6a4c]" : "bg-ink-600"}`}
                      style={{ width: activeEngine === i ? 34 : 12 }}
                    />
                    {activeEngine === i ? "routing" : "idle"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
              谷歌翻译开箱即用，AI 引擎走 OpenAI 兼容接口，Ollama 留在本机；译文按段缓存，二次阅读零请求。
            </p>
          </div>
        </Reveal>

        {/* 自定义 StyleLab */}
        <Reveal delay={90} className="md:col-span-3">
          <div className={CARD}>
            <CardTitle icon={<IconSliders />} t="深度自定义 · 即刻生效" d="style lab → 作用于上方演示" />
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">显示模式</p>
                <div className="flex rounded-md bg-[#0b0d10] p-0.5">
                  {(["bilingual", "only", "source"] as DisplayMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded py-1.5 text-[11.5px] transition-colors ${
                        mode === m ? "bg-[#d5482f] text-[#f5f1e8]" : "text-mute hover:text-bone"
                      }`}
                    >
                      {m === "bilingual" ? "双语对照" : m === "only" ? "仅译文" : "原文"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">分隔符</p>
                  <div className="flex gap-1">
                    {(["none", "line", "dashed"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setStyle({ ...style, divider: d })}
                        className={`flex-1 rounded border py-1.5 text-[11px] transition-colors ${
                          style.divider === d ? "border-[#d5482f]/70 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 text-mute hover:text-bone"
                        }`}
                      >
                        {d === "none" ? "无" : d === "line" ? "细线" : "虚线"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">译文字体</p>
                  <div className="flex gap-1">
                    {(["serif", "sans"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setStyle({ ...style, font: f })}
                        className={`flex-1 rounded border py-1.5 text-[11px] transition-colors ${
                          style.font === f ? "border-[#d5482f]/70 bg-[#d5482f]/15 text-[#ef6a4c]" : "border-white/10 text-mute hover:text-bone"
                        } ${f === "serif" ? "font-display" : ""}`}
                      >
                        {f === "serif" ? "衬线" : "无衬线"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute">译文配色</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["jade", "#2e7d74", "黛青"],
                      ["cinnabar", "#d5482f", "朱砂"],
                      ["ink", "#5d6169", "墨灰"],
                      ["gold", "#b98a3e", "赭金"],
                    ] as const
                  ).map(([c, hex, label]) => (
                    <button
                      key={c}
                      onClick={() => setStyle({ ...style, color: c })}
                      className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-[10.5px] transition-all ${
                        style.color === c ? "border-bone/60 text-bone" : "border-white/10 text-mute hover:text-bone"
                      }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-full" style={{ background: hex }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <a
                href="#demo"
                className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#57a79b] underline underline-offset-4 transition-colors hover:text-[#7fc4b8]"
              >
                回到演示窗口查看效果 →
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
