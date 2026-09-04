import { useState } from "react";
import { FAQS } from "../data/content";
import { useSettings } from "../state/settings";
import { Reveal } from "../hooks/useReveal";
import { copyText } from "../lib/translate";
import { SectionHead } from "./Hero";
import { IconCheck, IconCopy, IconPlus, Logo } from "./Icons";

const RELEASES = "https://github.com/hou-zp/translate-ext/releases/latest";

const STEPS = [
  {
    n: "01",
    t: "下载扩展包",
    d: "从 GitHub Releases 下载对应浏览器的 zip（chrome / firefox / safari），Chrome / Edge 用户先解压备用。",
    code: "releases/latest → chrome.zip",
    href: RELEASES,
  },
  {
    n: "02",
    t: "打开扩展页",
    d: "地址栏输入扩展管理地址；Edge 用户替换为 edge://extensions。",
    code: "chrome://extensions",
  },
  {
    n: "03",
    t: "开发者模式",
    d: "打开页面右上角的「开发者模式」开关，解锁本地加载能力。",
    code: "developer mode → on",
  },
  {
    n: "04",
    t: "加载并固定",
    d: "点击「加载已解压的扩展程序」选择目录；把 文/A 图标固定到工具栏即完成。",
    code: "load unpacked ✓",
  },
];

export function Install() {
  const [copied, setCopied] = useState<string | null>(null);
  const doCopy = async (text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(text);
      window.setTimeout(() => setCopied(null), 1600);
    }
  };
  return (
    <section id="install" className="mx-auto max-w-6xl px-4 py-20 md:px-6">
      <SectionHead
        index="04 / install"
        title="四步装进浏览器"
        desc="Manifest V3，直接从 GitHub Releases 下载即可；也支持 Firefox / Safari。"
      />
      <div className="relative grid gap-4 md:grid-cols-4">
        <span className="pointer-events-none absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block" />
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <div className="group relative h-full rounded-lg border border-white/10 bg-[#10141a]/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#d5482f]/50">
              <p className="font-display text-[34px] font-black leading-none text-[#232b35] transition-colors duration-300 group-hover:text-[#d5482f]">
                {s.n}
              </p>
              <h3 className="mt-3 font-display text-[16px] font-bold text-bone">{s.t}</h3>
              <p className="mt-2 min-h-[60px] text-[12.5px] leading-relaxed text-mute">{s.d}</p>
              {"href" in s && s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex w-full items-center justify-between rounded border border-[#d5482f]/50 bg-[#d5482f]/10 px-2.5 py-1.5 font-mono text-[10.5px] text-[#ef6a4c] transition-colors hover:bg-[#d5482f]/20"
                >
                  <span className="truncate">{s.code}</span>
                  <span className="shrink-0">→</span>
                </a>
              ) : (
                <button
                  onClick={() => doCopy(s.code)}
                  title="复制"
                  className="mt-3 flex w-full items-center justify-between rounded border border-white/10 bg-[#0b0d10] px-2.5 py-1.5 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-white/25 hover:text-bone"
                >
                  <span className="truncate">{s.code}</span>
                  {copied === s.code ? <IconCheck className="h-3.5 w-3.5 shrink-0 text-[#57a79b]" /> : <IconCopy className="h-3.5 w-3.5 shrink-0" />}
                </button>
              )}
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={120}>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <a
            href={RELEASES}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md bg-[#d5482f] px-4 py-2 text-[13px] font-medium text-[#f5f1e8] transition-all hover:-translate-y-px hover:bg-[#ef6a4c]"
          >
            前往 Releases 下载
            <span aria-hidden="true">→</span>
          </a>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">适配目标</span>
          {["Chrome", "Edge", "Firefox", "Safari"].map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10.5px] text-bone-dim transition-colors hover:border-[#57a79b]/60 hover:text-[#57a79b]"
            >
              {t}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="border-t border-white/5 bg-[#0e1216]/60">
      <div className="mx-auto max-w-4xl px-4 py-20 md:px-6">
        <SectionHead index="05 / faq" title="被问得最多的六件事" desc="关于真实性、隐私与边界的坦白说明。" />
        <div className="divide-y divide-white/5 rounded-lg border border-white/10 bg-[#10141a]/70">
          {FAQS.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                aria-expanded={open === i}
              >
                <span className="font-mono text-[10.5px] text-[#ef6a4c]">Q{i + 1}</span>
                <span className="flex-1 font-display text-[15px] font-bold text-bone">{f.q}</span>
                <IconPlus
                  className={`h-4 w-4 shrink-0 text-mute transition-transform duration-300 ${open === i ? "rotate-45 text-[#ef6a4c]" : ""}`}
                />
              </button>
              <div className={`acc-panel ${open === i ? "open" : ""}`}>
                <div>
                  <p className="px-5 pb-5 pl-[52px] text-[13.5px] leading-[1.9] text-bone-dim">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { s } = useSettings();
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <Logo className="h-9 w-9 text-bone" />
              <div>
                <p className="font-display text-[18px] font-black text-bone">AI 沉浸翻译 · translate-ext</p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-mute">open source · v1.2.1</p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-[12.5px] leading-relaxed text-mute">
              对标沉浸式翻译的开源浏览器扩展：整页双语、划词、悬停、输入框翻译、双语字幕、
              文档翻译、术语库、生词本、WebDAV 云同步，翻译服务自选。愿每种语言都停留在另一种语言伸手可及之处。
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">本页导航</p>
            <ul className="space-y-2 text-[12.5px] text-bone-dim">
              {[
                ["#demo", "在线体验 · 模拟浏览器"],
                ["#features", "功能矩阵"],
                ["#engines", "引擎路由表"],
                ["#install", "安装流程"],
                ["#faq", "常见问题"],
              ].map(([h, t]) => (
                <li key={h}>
                  <a href={h} className="transition-colors hover:text-[#ef6a4c]">
                    {t}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-4">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">快捷键备忘</p>
            <ul className="space-y-2 font-mono text-[11px] text-bone-dim">
              <li className="flex justify-between gap-3">
                翻译 / 收起本页 <span className="kbd">{s.keys.togglePage}</span>
              </li>
              <li className="flex justify-between gap-3">
                快捷面板 <span className="kbd">{s.keys.openPanel}</span>
              </li>
              <li className="flex justify-between gap-3">
                侧边栏 <span className="kbd">{s.keys.toggleSide}</span>
              </li>
              <li className="flex justify-between gap-3">
                翻译输入框 <span className="kbd">空格 ×3</span>
              </li>
              <li className="flex justify-between gap-3">
                划词浮译 <span className="kbd">拖选正文</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-white/5 pt-6 font-mono text-[10px] text-ink-500">
          <span>© 2026 translate-ext</span>
          <span className="h-1 w-1 rounded-full bg-ink-600" />
          <span>演示语料为本站原创散文 · 真实扩展由浏览器直连你配置的翻译服务</span>
          <span className="ml-auto">made of ink &amp; paper · github.com/hou-zp/translate-ext</span>
        </div>
      </div>
    </footer>
  );
}
