export interface AssCue {
  start: string;
  end: string;
  /** dialogue text with override tags stripped, \N converted to newline */
  text: string;
  /** index into the file's line array (for rebuilding) */
  lineIdx: number;
}

export interface AssFile {
  lines: string[];
  cues: AssCue[];
  /** field index of "Text" in the Events Format line */
  textField: number;
  /** total number of fields in the Format line */
  fieldCount: number;
}

/** Strip {\...} override tags and convert \N / \n to real newlines. */
export function cleanAssText(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\N|\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .trim();
}

/** Parse an .ass / .ssa subtitle file. */
export function parseAss(content: string): AssFile {
  const lines = content.replace(/^\ufeff/, '').replace(/\r/g, '').split('\n');
  const cues: AssCue[] = [];
  let inEvents = false;
  let fields: string[] = [];
  let textField = 9;

  lines.forEach((line, lineIdx) => {
    const trimmed = line.trim();
    if (/^\[.*\]$/.test(trimmed)) {
      inEvents = /^\[events\]$/i.test(trimmed);
      return;
    }
    if (!inEvents) return;
    if (/^format\s*:/i.test(trimmed)) {
      fields = trimmed
        .slice(trimmed.indexOf(':') + 1)
        .split(',')
        .map((f) => f.trim().toLowerCase());
      const idx = fields.indexOf('text');
      if (idx >= 0) textField = idx;
      return;
    }
    if (!/^dialogue\s*:/i.test(trimmed)) return;
    const body = trimmed.slice(trimmed.indexOf(':') + 1);
    const fieldCount = fields.length || 10;
    // Text is the last field and may itself contain commas
    const parts = body.split(',');
    if (parts.length < fieldCount) return;
    const startIdx = fields.length ? fields.indexOf('start') : 1;
    const endIdx = fields.length ? fields.indexOf('end') : 2;
    const rawText = parts.slice(textField).join(',');
    const text = cleanAssText(rawText);
    if (!text) return;
    cues.push({
      start: (parts[startIdx >= 0 ? startIdx : 1] ?? '').trim(),
      end: (parts[endIdx >= 0 ? endIdx : 2] ?? '').trim(),
      text,
      lineIdx,
    });
  });

  return { lines, cues, textField, fieldCount: fields.length || 10 };
}

/**
 * Rebuild the full .ass file with translations substituted into the Dialogue
 * text field. Bilingual mode keeps the original above the translation (\N).
 */
export function buildAss(
  file: AssFile,
  translations: (string | null)[],
  bilingual: boolean,
): string {
  const lines = [...file.lines];
  file.cues.forEach((cue, i) => {
    const tr = translations[i];
    if (!tr) return;
    const line = lines[cue.lineIdx];
    if (!line) return;
    const colon = line.indexOf(':');
    const prefix = line.slice(0, colon + 1);
    const parts = line.slice(colon + 1).split(',');
    const head = parts.slice(0, file.textField).join(',');
    const rawText = parts.slice(file.textField).join(',');
    const newText = bilingual
      ? `${rawText}\\N${tr.replace(/\n/g, '\\N')}`
      : tr.replace(/\n/g, '\\N');
    lines[cue.lineIdx] = `${prefix}${head},${newText}`;
  });
  return lines.join('\n');
}
