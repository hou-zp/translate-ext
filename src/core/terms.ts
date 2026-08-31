import type { TermEntry } from './config';

/** Terms whose source actually appears in the text. */
export function matchTerms(text: string, terms: TermEntry[]): TermEntry[] {
  if (terms.length === 0) return [];
  const lower = text.toLowerCase();
  return terms.filter((t) => {
    const src = t.source.trim();
    if (!src) return false;
    return t.caseSensitive ? text.includes(src) : lower.includes(src.toLowerCase());
  });
}

/** Glossary block appended to AI system prompts. */
export function glossaryPrompt(terms: TermEntry[]): string {
  if (terms.length === 0) return '';
  const lines = terms.map((t) => `- "${t.source}" => "${t.target}"`).join('\n');
  return (
    '\n\nGlossary (mandatory): whenever a source term below appears, ' +
    'use exactly the given translation for it:\n' +
    lines
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * For non-AI engines: replace matched terms with numeric placholders the
 * engine passes through untouched, so `restoreTerms` can substitute the
 * fixed target translation afterwards.
 *
 * Placeholder shape `⟦0⟧` survives Google/DeepL/Microsoft round trips.
 */
export function lockTerms(
  text: string,
  terms: TermEntry[],
): { locked: string; used: TermEntry[] } {
  const used: TermEntry[] = [];
  let locked = text;
  for (const term of terms) {
    const src = term.source.trim();
    if (!src) continue;
    const re = new RegExp(escapeRegExp(src), term.caseSensitive ? 'g' : 'gi');
    if (!re.test(locked)) continue;
    const idx = used.length;
    used.push(term);
    locked = locked.replace(re, `⟦${idx}⟧`);
  }
  return { locked, used };
}

/** Substitute placeholders back with the fixed target translations. */
export function restoreTerms(translated: string, used: TermEntry[]): string {
  let out = translated;
  used.forEach((term, idx) => {
    // engines sometimes add spaces around or inside the placeholder
    const re = new RegExp(`⟦\\s*${idx}\\s*⟧`, 'g');
    out = out.replace(re, term.target);
  });
  return out;
}

/** Parse a glossary CSV: `source,target[,cs]` per line. Tolerates quotes/BOM. */
export function parseTermsCsv(csv: string): TermEntry[] {
  const out: TermEntry[] = [];
  for (const rawLine of csv.replace(/^\ufeff/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cells = line
      .split(',')
      .map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());
    const [source, target, cs] = cells;
    if (!source || !target) continue;
    if (/^source$/i.test(source)) continue; // header row
    out.push({
      source,
      target,
      caseSensitive: /^(1|true|yes|y)$/i.test(cs ?? ''),
    });
  }
  return out;
}

export function termsToCsv(terms: TermEntry[]): string {
  return ['source,target,caseSensitive']
    .concat(terms.map((t) => `${t.source},${t.target},${t.caseSensitive ? '1' : ''}`))
    .join('\n');
}

/** Stable-ish hash so the cache key changes when the glossary changes. */
export function termsSignature(terms: TermEntry[]): string {
  if (terms.length === 0) return '';
  let h = 0x811c9dc5;
  const s = terms.map((t) => `${t.source}\u0000${t.target}`).join('\u0001');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}
