import { useEffect, useRef, useState } from "react";
import { fmtClock, useSettings } from "../state/settings";
import { IconBot, IconClose, IconDb, IconPanelRight } from "./Icons";

export type OutlineItem = { id: string; label: string; state: "idle" | "loading" | "done" | "error" };

export default function SidePanel({
  open,
  onClose,
  outline,
  onJump,
  ask,
}: {
  open: boolean;
  onClose: () => void;
  outline: OutlineItem[];
  onJump: (id: string) => void;
  ask: (text: string) => Promise<string>;
}) {
  const { s, log, clearLog } = useSettings();
  const [tab, setTab] = useState<"doc" | "log" | "ai">("doc");
  const [msgs, setMsgs] = useState<{ role: "u" | "a"; text: string }[]>([
    { role: "a", text: "你好，我是本页助手。可以让我「翻译」一段英文，或输入「摘要」查看本页概览。" },
  ]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs, tab, log.length]);

  if (!open) return null;

  const submit = async () => {
    const text = q.trim();
    if (!text || busy) return;
    setQ("");
    setMsgs((m) => [...m, { role: "u", text }]);
    setBusy(true);
    try {
      const ans = await ask(text);
      setMsgs((m) => [...m, { role: "a", text: ans }]);
    } catch {
      setMsgs((m) => [...m, { role: "a", text: "在线引擎不可达，且未命中内置语料。请稍后重试。" }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex w-[248px] shrink-0 flex-col border-l border-white/5 bg-[#10141a]">
      <div className="flex items-center gap-1 border-b border-white/5 px-2 pt-2">
        {(
          [
            ["doc", "文档"],
            ["log", "历史"],
            ["ai", "助手"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative px-2.5 py-1.5 text-[11.5px] transition-colors ${
              tab === k ? "text-bone" : "text-mute hover:text-bone-dim"
            }`}
          >
            {label}
            {tab === k && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#d5482f]" />}
          </button>
        ))}
        <button onClick={onClose} title="关闭侧边栏" className="ml-auto rounded p-1 text-mute transition-colors hover:bg-white/5 hover:text-bone">
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {tab === "doc" && (
        <div className="scroll-dark flex-1 overflow-y-auto p-2.5">
          <div className="mb-2.5 rounded-md border border-white/5 bg-[#141920] p-2.5 font-mono text-[9.5px] leading-relaxed text-mute">
            <p className="flex justify-between">
              <span>目标</span>
              <span className="text-bone-dim">{s.basic.target}</span>
            </p>
            <p className="flex justify-between">
              <span>路由</span>
              <span className="text-bone-dim">{s.services.route}</span>
            </p>
            <p className="flex justify-between">
              <span>段落</span>
              <span className="text-bone-dim">
                {outline.filter((o) => o.state === "done").length}/{outline.length} 已译
              </span>
            </p>
          </div>
          <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
            <IconPanelRight className="h-3 w-3" /> 页面大纲 · 点击跳转
          </p>
          <ul className="space-y-0.5">
            {outline.map((o) => (
              <li key={o.id}>
                <button
                  onClick={() => onJump(o.id)}
                  className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      o.state === "done"
                        ? "bg-[#57a79b]"
                        : o.state === "loading"
                          ? "animate-pulse bg-[#b98a3e]"
                          : o.state === "error"
                            ? "bg-[#d5482f]"
                            : "bg-ink-600"
                    }`}
                  />
                  <span className="truncate text-[11px] text-bone-dim transition-colors group-hover:text-bone">{o.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "log" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-2.5 pb-1 pt-2">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-mute">
              <IconDb className="h-3 w-3" /> 翻译历史 · {log.length}
            </p>
            {log.length > 0 && (
              <button onClick={clearLog} className="font-mono text-[9.5px] text-mute underline underline-offset-2 hover:text-bone">
                清空
              </button>
            )}
          </div>
          <div ref={listRef} className="scroll-dark flex-1 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
            {log.length === 0 && <p className="pt-6 text-center font-mono text-[10px] text-ink-500">暂无记录 · 去翻译点什么吧</p>}
            {[...log].reverse().map((l) => (
              <div key={l.id} className="rounded border border-white/5 bg-[#141920] px-2 py-1.5">
                <p className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-wider text-ink-500">
                  <span className={l.kind === "err" ? "text-[#ef6a4c]" : l.kind === "ok" ? "text-[#57a79b]" : ""}>{l.kind}</span>
                  <span>{fmtClock(l.t)}</span>
                </p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-bone-dim">{l.msg}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "ai" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div ref={listRef} className="scroll-dark flex-1 space-y-2 overflow-y-auto p-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "u" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-lg px-2.5 py-1.5 text-[11.5px] leading-relaxed ${
                    m.role === "u" ? "bg-[#d5482f]/85 text-[#f5f1e8]" : "border border-white/5 bg-[#141920] text-bone-dim"
                  }`}
                >
                  {m.role === "a" && <IconBot className="mb-1 h-3.5 w-3.5 text-[#57a79b]" />}
                  {m.text}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-white/5 bg-[#141920] px-2.5 py-1.5">
                  <span className="inline-block h-2 w-16 animate-pulse rounded bg-ink-600" />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-1.5 border-t border-white/5 p-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="问我本页，或丢一段英文…"
              className="min-w-0 flex-1 rounded border border-white/10 bg-[#141920] px-2 py-1.5 text-[11.5px] text-bone outline-none placeholder:text-ink-500 focus:border-[#d5482f]/60"
            />
            <button
              onClick={submit}
              className="rounded bg-[#d5482f] px-2.5 text-[11px] text-[#f5f1e8] transition-colors hover:bg-[#ef6a4c] disabled:opacity-40"
              disabled={busy || !q.trim()}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
