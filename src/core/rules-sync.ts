import { loadConfig, sanitizeRules, saveConfig } from './config';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type RulesRefreshResult =
  | { ok: true; updated: boolean; count: number }
  | { ok: false; error: string };

/**
 * Fetch the rule subscription and update the cached rules. Shared by the
 * manual refresh button and the background daily alarm. A payload that fails
 * validation (or an unchanged payload) never clobbers the existing cache.
 */
export async function refreshSubscribedRules(url?: string): Promise<RulesRefreshResult> {
  const cfg = await loadConfig();
  const target = (url ?? cfg.ruleSubscribeUrl).trim();
  if (!target) return { ok: false, error: '未配置订阅地址' };
  try {
    const res = await fetch(target, { cache: 'no-cache' });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    const hash = await sha256Hex(text);
    if (hash === cfg.subscribedRulesHash && target === cfg.ruleSubscribeUrl) {
      return { ok: true, updated: false, count: cfg.subscribedRules.length };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: '订阅内容不是合法 JSON' };
    }
    if (!Array.isArray(parsed)) return { ok: false, error: 'JSON 顶层必须是规则数组' };
    const rules = sanitizeRules(parsed);
    if (rules.length === 0) return { ok: false, error: '订阅中没有任何有效规则' };
    await saveConfig({
      ruleSubscribeUrl: target,
      subscribedRules: rules,
      subscribedRulesHash: hash,
      subscribedRulesUpdatedAt: Date.now(),
    });
    return { ok: true, updated: true, count: rules.length };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
