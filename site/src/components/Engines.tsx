import { ENGINES } from "../data/content";
import { Reveal, useInView } from "../hooks/useReveal";
import { SectionHead } from "./Hero";

function LitDots({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= n ? "bg-[#d5482f]" : "bg-ink-600"}`}
        />
      ))}
    </span>
  );
}

export default function Engines() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <section id="engines" className="border-y border-white/5 bg-[#0e1216]/60">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <SectionHead
          index="03 / engines"
          title="引擎路由表"
          desc="没有万能引擎：公文要准确，小说要文气，离线要保命。路由器按场景分发，失败即降级。"
        />
        <div ref={ref} className="overflow-x-auto scroll-dark rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-white/10 bg-[#10141a] font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
                <th className="px-4 py-3 font-medium">引擎</th>
                <th className="px-4 py-3 font-medium">语种</th>
                <th className="px-4 py-3 font-medium">响应</th>
                <th className="px-4 py-3 font-medium">额度</th>
                <th className="px-4 py-3 font-medium">文学性</th>
              </tr>
            </thead>
            <tbody>
              {ENGINES.map((e, i) => (
                <tr
                  key={e.name}
                  className="group border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-display text-[14.5px] font-bold text-bone transition-colors group-hover:text-[#ef6a4c]">
                      {e.name}
                    </p>
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-mute">{e.note}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[12px] text-bone-dim">{e.langs}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="h-1 w-24 overflow-hidden rounded-full bg-ink-700">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-[#2e7d74] to-[#57a79b] transition-all duration-1000 ease-out"
                          style={{ width: inView ? `${e.bar}%` : "0%", transitionDelay: `${i * 90}ms` }}
                        />
                      </span>
                      <span className="font-mono text-[11px] text-mute">{e.ms === 0 ? "<1ms" : `${e.ms}ms`}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11.5px] text-bone-dim">{e.free}</td>
                  <td className="px-4 py-3.5">
                    <LitDots n={e.lit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Reveal delay={120}>
          <p className="mt-4 font-mono text-[10.5px] leading-relaxed text-ink-500">
            * 谷歌翻译免费开箱即用；DeepL / 微软在官网注册即可获得免费额度；OpenAI 兼容接口支持 OpenAI、DeepSeek 及各类网关；Ollama 走本地模型，整条链路不出本机。密钥只存在你的浏览器里。
          </p>
        </Reveal>
      </div>
    </section>
  );
}
