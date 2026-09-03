import { useState } from "react";
import BrowserMock from "./components/BrowserMock";
import Engines from "./components/Engines";
import Features from "./components/Features";
import { Hero, Nav, SectionHead } from "./components/Hero";
import { Faq, Footer, Install } from "./components/InstallFaq";
import { Reveal } from "./hooks/useReveal";
import { SettingsProvider, useSettings, type DisplayMode, type TransStyle } from "./state/settings";

function Shell() {
  const { s, set } = useSettings();
  const mode: DisplayMode = s.basic.mode;
  const [style, setStyle] = useState<TransStyle>({ divider: "line", color: "jade", font: "serif" });
  const setMode = (m: DisplayMode) => set("basic", { mode: m });

  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950 font-body text-bone">
      <div className="grid-bg pointer-events-none fixed inset-0" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-[#141920]/80 to-transparent" aria-hidden="true" />

      <div className="relative">
        <Nav />
        <Hero />

        <section id="demo" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 md:px-6">
          <SectionHead
            index="01 / live demo"
            title="一扇活的浏览器"
            desc="不是录屏、不是图片：工具栏、弹窗、悬浮球、快捷面板、侧边栏与完整设置页皆可交互，译文逐段 cascade 落入原文之下。"
          />
          <Reveal>
            <BrowserMock mode={mode} setMode={setMode} style={style} setStyle={setStyle} />
          </Reveal>
        </section>

        <Features mode={mode} setMode={setMode} style={style} setStyle={setStyle} />
        <Engines />
        <Install />
        <Faq />
        <Footer />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}
