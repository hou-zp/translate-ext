import { STATS } from "../data/content";
import { Reveal } from "../hooks/useReveal";
import { IconArrowDown, IconSpark, Logo } from "./Icons";

const NAV = [
  { href: "#demo", label: "在线体验" },
  { href: "#features", label: "功能矩阵" },
  { href: "#engines", label: "引擎路由" },
  { href: "#install", label: "安装" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0b0d10]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <Logo className="h-7 w-7 text-bone transition-transform group-hover:-rotate-3" />
          <span className="leading-none">
            <span className="block font-display text-[15px] font-black tracking-wide text-bone">AI 沉浸翻译</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-mute">translate-ext</span>
          </span>
        </a>
        <nav className="ml-auto hidden items-center gap-5 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="relative text-[12.5px] text-bone-dim transition-colors hover:text-bone after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-[#d5482f] after:transition-all after:duration-300 hover:after:w-full"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <span className="ml-auto hidden rounded-full border border-white/10 px-2.5 py-1 font-mono text-[10px] text-mute md:ml-0 md:block">
          v1.2.0 · open source
        </span>
        <button
          onClick={() => window.dispatchEvent(new Event("ir:open-popup"))}
          className="flex items-center gap-1.5 rounded-md bg-[#d5482f] px-3 py-1.5 text-[12px] font-medium text-[#f5f1e8] transition-all hover:-translate-y-px hover:bg-[#ef6a4c]"
        >
          <IconSpark className="h-3.5 w-3.5" />
          打开扩展弹窗
        </button>
      </div>
    </header>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 md:px-6 md:pt-20">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Reveal>
            <p className="mb-5 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-[#ef6a4c]">
              <span className="h-px w-10 bg-[#d5482f]" />
              browser extension · open source
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-[clamp(2.4rem,6.2vw,4.3rem)] font-black leading-[1.12] tracking-tight text-bone">
              让译文，
              <br />
              长在<span className="underline-swipe">原文</span>的旁边。
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-[15px] leading-[1.9] text-bone-dim">
              AI 沉浸翻译不替换页面，而是把双语并排织进每一段：原文在上建立语感，译文在下即时反馈。
              悬停试译、划词浮译、输入框三次空格即译，还有 YouTube 双语字幕、PDF 文档翻译、术语库与生词本——下面这扇「浏览器」是活的，请直接动手。
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              {STATS.map((s) => (
                <div key={s.v} className="group">
                  <p className="font-display text-[26px] font-black leading-none text-bone transition-colors group-hover:text-[#ef6a4c]">
                    {s.k}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-mute">{s.v}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        <div className="lg:col-span-5">
          <Reveal delay={200}>
            <div className="relative rounded-lg border border-white/10 bg-[#10141a]/80 p-5">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-mute">demo guide · 三步上手</p>
              <ol className="space-y-4">
                {[
                  ["01", "点击工具栏右侧的 文/A 图标，展开扩展弹窗，切换显示模式与译文样式。"],
                  ["02", "在正文里拖选任意一句，浮动气泡会在选区下方给出译文。"],
                  ["03", "滚到页尾评论区，输入英文后连按三次空格，输入内容原地被翻译。"],
                ].map(([n, t]) => (
                  <li key={n} className="group flex gap-3.5">
                    <span className="font-display text-[20px] font-black leading-none text-[#d5482f] transition-transform group-hover:translate-y-0.5">
                      {n}
                    </span>
                    <p className="text-[13px] leading-relaxed text-bone-dim transition-colors group-hover:text-bone">{t}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-5 flex items-center gap-2 border-t border-white/5 pt-4 font-mono text-[10.5px] text-mute">
                <IconArrowDown className="h-3.5 w-3.5 animate-bounce text-[#57a79b]" />
                下方窗口为真实交互模拟，非录屏
              </div>
              <span className="pointer-events-none absolute -right-3 -top-3 rotate-6 rounded border border-[#d5482f]/50 bg-[#d5482f]/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[#ef6a4c]">
                live mock
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export function SectionHead({
  index,
  title,
  desc,
}: {
  index: string;
  title: string;
  desc: string;
}) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.26em] text-[#ef6a4c]">
          {index}
        </p>
        <h2 className="font-display text-[clamp(1.7rem,3.6vw,2.6rem)] font-black leading-tight text-bone">{title}</h2>
      </div>
      <p className="max-w-md pb-1 text-[13.5px] leading-relaxed text-mute">{desc}</p>
      <span className="mb-2 ml-auto hidden h-px flex-1 bg-gradient-to-r from-white/15 to-transparent md:block" />
    </Reveal>
  );
}
