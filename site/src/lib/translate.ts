import { offlineTranslate, type TargetCode } from "../data/content";

export type TranslateResult = { text: string; via: "corpus" | "google" | "deepl" };

/**
 * 介绍页为纯前端演示：所有「翻译」均来自内置双语语料，不发起任何网络请求。
 * via 仅用于在演示 UI 中展示该段由哪个引擎「负责」，与真实扩展行为无关。
 */
export async function translate(text: string, target: TargetCode, _route = "auto"): Promise<TranslateResult> {
  await new Promise((r) => setTimeout(r, 240 + Math.random() * 200));
  const hit = offlineTranslate(text);
  if (hit && target === "zh-CN") return { text: hit, via: "corpus" };
  // 语料未命中（非简中目标 / 演示语料之外的内容）：抛错，UI 会展示重试提示
  throw new Error("demo corpus miss");
}

export const VIA_LABEL: Record<TranslateResult["via"], string> = {
  corpus: "演示语料 · 离线",
  google: "Google · 演示",
  deepl: "DeepL · 演示",
};

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
