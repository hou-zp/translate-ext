import type { AppConfig, ExpertDef } from './config';
import { langEnglishName } from './langs';

/**
 * Built-in "AI expert" prompt personas. `{{from}}` / `{{to}}` are replaced
 * with English language names before being sent to the model.
 */
export const BUILTIN_EXPERTS: ExpertDef[] = [
  {
    id: 'general',
    name: '通用',
    builtin: true,
    prompt:
      'You are a professional translator. Translate the given text from {{from}} to {{to}}. ' +
      'Preserve the original meaning, tone and formatting. Output the translation only, with no explanations.',
  },
  {
    id: 'tech',
    name: '技术文档',
    builtin: true,
    prompt:
      'You are a senior technical documentation translator. Translate from {{from}} to {{to}}. ' +
      'Keep code snippets, identifiers, CLI commands, file paths and product names untranslated. ' +
      'Use precise, established technical terminology. Output the translation only.',
  },
  {
    id: 'academic',
    name: '学术论文',
    builtin: true,
    prompt:
      'You are an academic translator specializing in scholarly papers. Translate from {{from}} to {{to}} ' +
      'in a formal, rigorous register. Keep citations, formulas, variable names and references intact. ' +
      'Output the translation only.',
  },
  {
    id: 'news',
    name: '新闻资讯',
    builtin: true,
    prompt:
      'You are a news translator. Translate from {{from}} to {{to}} in concise, natural journalistic style. ' +
      'Keep names of people, organizations and places accurate. Output the translation only.',
  },
  {
    id: 'fiction',
    name: '文学小说',
    builtin: true,
    prompt:
      'You are a literary translator. Translate from {{from}} to {{to}} with vivid, flowing prose that preserves ' +
      'the mood, voice and style of the original. Prefer natural expressions over literal wording. ' +
      'Output the translation only.',
  },
  {
    id: 'legal',
    name: '法律合同',
    builtin: true,
    prompt:
      'You are a legal translator. Translate from {{from}} to {{to}} using precise legal terminology, ' +
      'keeping clause numbering and defined terms consistent. Do not paraphrase away legal nuances. ' +
      'Output the translation only.',
  },
  {
    id: 'medical',
    name: '医学文献',
    builtin: true,
    prompt:
      'You are a medical translator. Translate from {{from}} to {{to}} using standard clinical and ' +
      'pharmacological terminology. Keep drug names, dosages and units exact. Output the translation only.',
  },
];

export function allExperts(cfg: Pick<AppConfig, 'customExperts'>): ExpertDef[] {
  return [...BUILTIN_EXPERTS, ...cfg.customExperts];
}

export function getExpert(cfg: Pick<AppConfig, 'customExperts'>, id: string | undefined): ExpertDef {
  return allExperts(cfg).find((e) => e.id === id) ?? BUILTIN_EXPERTS[0]!;
}

export function buildSystemPrompt(expert: ExpertDef, from: string, to: string): string {
  const fromName = from === 'auto' ? 'the detected source language' : langEnglishName(from);
  const toName = langEnglishName(to);
  return expert.prompt.replaceAll('{{from}}', fromName).replaceAll('{{to}}', toName);
}

/**
 * Batch user prompt: send numbered segments as JSON and require JSON back so
 * multiple paragraphs survive a single round trip.
 */
export function buildBatchUserPrompt(texts: string[]): string {
  const obj: Record<string, string> = {};
  texts.forEach((t, i) => {
    obj[String(i + 1)] = t;
  });
  return (
    'Translate every value of the following JSON object. Reply with ONLY a valid JSON object ' +
    'using exactly the same numeric keys, where each value is the translation of the corresponding input. ' +
    'Do not merge, split, add or drop keys.\n\n' +
    JSON.stringify(obj, null, 0)
  );
}

/**
 * Tolerant parser for the model's batch reply. Returns per-index strings or
 * null for entries the model failed to produce.
 */
export function parseBatchResponse(raw: string, count: number): (string | null)[] {
  const out: (string | null)[] = new Array(count).fill(null);
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const obj = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      for (let i = 0; i < count; i++) {
        const v = obj[String(i + 1)];
        if (typeof v === 'string' && v.length > 0) out[i] = v;
      }
      return out;
    } catch {
      // fall through to single-text fallback
    }
  }
  if (count === 1) {
    const t = raw.trim();
    if (t.length > 0) out[0] = t;
  }
  return out;
}

/** Prompt for the "AI refine" second pass: polish a draft translation. */
export function buildRefinePrompts(
  expert: ExpertDef,
  from: string,
  to: string,
  original: string,
  draft: string,
): { system: string; user: string } {
  const toName = langEnglishName(to);
  const system =
    buildSystemPrompt(expert, from, to) +
    ` You are now acting as a translation editor: given a source text and a draft ${toName} translation, ` +
    'produce an improved, natural and accurate final translation. Output the improved translation only.';
  const user = `<source>\n${original}\n</source>\n<draft>\n${draft}\n</draft>`;
  return { system, user };
}
