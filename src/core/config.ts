import { browser } from 'wxt/browser';

export type ProviderId = 'google' | 'deepl' | 'microsoft' | 'openai' | 'ollama';
export type DisplayMode = 'bilingual' | 'replace';
export type TranslationStyle = 'plain' | 'underline' | 'dashed' | 'quote' | 'highlight';
export type HoverModifier = 'none' | 'shift' | 'alt' | 'ctrl';

export interface ProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Azure translator region (microsoft only) */
  region?: string;
  /** Max parallel requests, falls back to provider default */
  concurrency?: number;
}

export interface ExpertDef {
  id: string;
  name: string;
  /** System prompt template, supports {{from}} / {{to}} placeholders */
  prompt: string;
  builtin?: boolean;
}

/** A glossary entry: `source` must always be translated as `target`. */
export interface TermEntry {
  source: string;
  target: string;
  caseSensitive?: boolean;
}

/** Per-site translation rule (matched by hostname, most specific wins). */
export interface SiteRule {
  /** hostname pattern, e.g. "example.com" (matches subdomains) */
  pattern: string;
  /** CSS selector for elements that must NOT be translated */
  excludeSelector?: string;
  /** CSS selector to restrict translation to (empty = whole page) */
  includeSelector?: string;
  displayMode?: DisplayMode;
  translationStyle?: TranslationStyle;
}

export interface AppConfig {
  configVersion: number;
  sourceLang: string;
  targetLang: string;
  provider: ProviderId;
  /** AI provider used for the refine pass (must be openai or ollama) */
  refineProvider: 'openai' | 'ollama';
  refineEnabled: boolean;
  expertId: string;
  displayMode: DisplayMode;
  translationStyle: TranslationStyle;
  hoverEnabled: boolean;
  hoverModifier: HoverModifier;
  selectionEnabled: boolean;
  floatButtonEnabled: boolean;
  cacheEnabled: boolean;
  autoTranslateSites: string[];
  neverTranslateSites: string[];
  providers: Record<ProviderId, ProviderSettings>;
  customExperts: ExpertDef[];
  /** Glossary applied to every translation */
  terms: TermEntry[];
  /**
   * Before translating a page, ask the AI to summarize it; the summary is
   * injected into every batch prompt for consistent terminology/pronouns.
   */
  contextEnabled: boolean;
  /** Triple-space input box translation */
  inputTranslateEnabled: boolean;
  /** Target language when translating input boxes (usually a foreign language) */
  inputTranslateLang: string;
  /** Bilingual subtitles on YouTube */
  youtubeSubtitlesEnabled: boolean;
  /** Bilingual subtitles on other video sites (Netflix, Bilibili, Coursera...) */
  videoSubtitlesEnabled: boolean;
  /** Live caption translation in web meetings (Google Meet / Zoom / Teams) */
  meetingCaptionsEnabled: boolean;
  /** Per-site selector rules (local) */
  siteRules: SiteRule[];
  /** Remote rule subscription URL (JSON array of SiteRule) */
  ruleSubscribeUrl: string;
  /** Rules fetched from the subscription (read-only, refreshed manually) */
  subscribedRules: SiteRule[];
  /** Mirror the config to chrome.storage.sync (cross-device, includes API keys) */
  syncEnabled: boolean;
  /** WebDAV backup target (e.g. https://dav.jianguoyun.com/dav/translate-ext/) */
  webdavUrl: string;
  webdavUser: string;
  webdavPass: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  configVersion: 1,
  sourceLang: 'auto',
  targetLang: 'zh-CN',
  provider: 'google',
  refineProvider: 'ollama',
  refineEnabled: false,
  expertId: 'general',
  displayMode: 'bilingual',
  translationStyle: 'underline',
  hoverEnabled: false,
  hoverModifier: 'shift',
  selectionEnabled: true,
  floatButtonEnabled: true,
  cacheEnabled: true,
  autoTranslateSites: [],
  neverTranslateSites: [],
  providers: {
    google: {},
    deepl: {},
    microsoft: {},
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    ollama: { baseUrl: 'http://127.0.0.1:11434', model: 'qwen2.5:7b' },
  },
  customExperts: [],
  terms: [],
  contextEnabled: false,
  inputTranslateEnabled: true,
  inputTranslateLang: 'en',
  youtubeSubtitlesEnabled: true,
  videoSubtitlesEnabled: true,
  meetingCaptionsEnabled: false,
  siteRules: [],
  ruleSubscribeUrl: '',
  subscribedRules: [],
  syncEnabled: false,
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
};

const STORAGE_KEY = 'app-config';

function migrate(raw: Partial<AppConfig> | undefined): AppConfig {
  if (!raw) return structuredClone(DEFAULT_CONFIG);
  const cfg: AppConfig = {
    ...structuredClone(DEFAULT_CONFIG),
    ...raw,
    providers: {
      ...structuredClone(DEFAULT_CONFIG.providers),
      ...(raw.providers ?? {}),
    },
  };
  cfg.configVersion = DEFAULT_CONFIG.configVersion;
  return cfg;
}

export async function loadConfig(): Promise<AppConfig> {
  const data = await browser.storage.local.get(STORAGE_KEY);
  return migrate(data[STORAGE_KEY] as Partial<AppConfig> | undefined);
}

export async function saveConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await loadConfig();
  const next = migrate({ ...current, ...patch });
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function replaceConfig(cfg: AppConfig): Promise<AppConfig> {
  const next = migrate(cfg);
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

/** Subscribe to config changes across extension contexts. Returns unsubscribe fn. */
export function onConfigChanged(cb: (cfg: AppConfig) => void): () => void {
  const listener = (
    changes: Record<string, { newValue?: unknown }>,
    area: string,
  ) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      cb(migrate(changes[STORAGE_KEY].newValue as Partial<AppConfig>));
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/** Hostname matcher for site rules ("example.com" matches sub.example.com too). */
export function hostMatches(host: string, rule: string): boolean {
  const r = rule.trim().toLowerCase();
  if (!r) return false;
  const h = host.toLowerCase();
  return h === r || h.endsWith('.' + r);
}

export function siteMode(cfg: AppConfig, host: string): 'always' | 'never' | 'normal' {
  if (cfg.neverTranslateSites.some((r) => hostMatches(host, r))) return 'never';
  if (cfg.autoTranslateSites.some((r) => hostMatches(host, r))) return 'always';
  return 'normal';
}

/**
 * Effective site rule for a host. Local rules win over subscribed rules;
 * within each list the longest (most specific) pattern wins.
 */
export function findSiteRule(cfg: AppConfig, host: string): SiteRule | null {
  const pick = (rules: SiteRule[]): SiteRule | null => {
    const matches = rules.filter((r) => hostMatches(host, r.pattern));
    if (matches.length === 0) return null;
    return matches.sort((a, b) => b.pattern.length - a.pattern.length)[0] ?? null;
  };
  return pick(cfg.siteRules) ?? pick(cfg.subscribedRules);
}
