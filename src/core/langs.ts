export interface LangDef {
  code: string;
  /** Chinese label shown in UI */
  label: string;
  /** English name used in AI prompts */
  english: string;
}

export const LANGS: LangDef[] = [
  { code: 'auto', label: '自动检测', english: 'Auto Detect' },
  { code: 'zh-CN', label: '简体中文', english: 'Simplified Chinese' },
  { code: 'zh-TW', label: '繁体中文', english: 'Traditional Chinese' },
  { code: 'en', label: '英语', english: 'English' },
  { code: 'ja', label: '日语', english: 'Japanese' },
  { code: 'ko', label: '韩语', english: 'Korean' },
  { code: 'fr', label: '法语', english: 'French' },
  { code: 'de', label: '德语', english: 'German' },
  { code: 'es', label: '西班牙语', english: 'Spanish' },
  { code: 'pt', label: '葡萄牙语', english: 'Portuguese' },
  { code: 'it', label: '意大利语', english: 'Italian' },
  { code: 'ru', label: '俄语', english: 'Russian' },
  { code: 'ar', label: '阿拉伯语', english: 'Arabic' },
  { code: 'th', label: '泰语', english: 'Thai' },
  { code: 'vi', label: '越南语', english: 'Vietnamese' },
  { code: 'id', label: '印尼语', english: 'Indonesian' },
  { code: 'hi', label: '印地语', english: 'Hindi' },
  { code: 'tr', label: '土耳其语', english: 'Turkish' },
  { code: 'pl', label: '波兰语', english: 'Polish' },
  { code: 'nl', label: '荷兰语', english: 'Dutch' },
];

export function langLabel(code: string): string {
  return LANGS.find((l) => l.code === code)?.label ?? code;
}

export function langEnglishName(code: string): string {
  return LANGS.find((l) => l.code === code)?.english ?? code;
}

/**
 * Cheap unicode-range based language guess, used to skip paragraphs that are
 * already in the target language. Returns a base lang code or 'other'.
 */
export function detectLangHeuristic(text: string): string {
  let cjk = 0;
  let kana = 0;
  let hangul = 0;
  let latin = 0;
  let cyrillic = 0;
  let arabic = 0;
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x40 || (cp >= 0x5b && cp <= 0x60)) continue; // digits/punct
    total++;
    if ((cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf)) cjk++;
    else if ((cp >= 0x3040 && cp <= 0x30ff) || (cp >= 0x31f0 && cp <= 0x31ff)) kana++;
    else if ((cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0x1100 && cp <= 0x11ff)) hangul++;
    else if ((cp >= 0x41 && cp <= 0x7a) || (cp >= 0xc0 && cp <= 0x24f)) latin++;
    else if (cp >= 0x400 && cp <= 0x4ff) cyrillic++;
    else if (cp >= 0x600 && cp <= 0x6ff) arabic++;
  }
  if (total === 0) return 'other';
  if (kana / total > 0.1) return 'ja';
  if (hangul / total > 0.3) return 'ko';
  if (cjk / total > 0.35) return 'zh';
  if (cyrillic / total > 0.5) return 'ru';
  if (arabic / total > 0.5) return 'ar';
  if (latin / total > 0.6) return 'latin';
  return 'other';
}

/** Whether a paragraph looks like it is already in the target language. */
export function looksLikeTarget(text: string, targetLang: string): boolean {
  const guess = detectLangHeuristic(text);
  const base = targetLang.split('-')[0];
  if (base === 'zh') return guess === 'zh';
  if (base === 'ja') return guess === 'ja';
  if (base === 'ko') return guess === 'ko';
  if (base === 'ru') return guess === 'ru';
  if (base === 'ar') return guess === 'ar';
  // For latin-script targets we cannot distinguish languages cheaply; never skip.
  return false;
}

/** Whether the text contains anything worth translating at all. */
export function isTranslatableText(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return false;
  // pure numbers / punctuation / URLs / emails
  if (/^[\d\s\p{P}\p{S}]+$/u.test(t)) return false;
  if (/^(https?:\/\/|www\.)\S+$/i.test(t)) return false;
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(t)) return false;
  return true;
}
