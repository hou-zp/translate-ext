export interface SrtCue {
  index: number;
  time: string;
  text: string;
}

/** Parse an SRT subtitle file into cues. */
export function parseSrt(content: string): SrtCue[] {
  const blocks = content.replace(/\r/g, '').split(/\n{2,}/);
  const cues: SrtCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) continue;
    let i = 0;
    let index = cues.length + 1;
    const firstLine = lines[0] ?? '';
    if (/^\d+$/.test(firstLine.trim())) {
      index = Number(firstLine.trim());
      i = 1;
    }
    const timeLine = lines[i];
    if (!timeLine || !timeLine.includes('-->')) continue;
    const text = lines.slice(i + 1).join('\n');
    if (!text.trim()) continue;
    cues.push({ index, time: timeLine.trim(), text });
  }
  return cues;
}

/** Serialize cues back to SRT, optionally keeping the original text above the translation. */
export function buildSrt(
  cues: SrtCue[],
  translations: (string | null)[],
  bilingual: boolean,
): string {
  return cues
    .map((cue, i) => {
      const tr = translations[i];
      const text = tr ? (bilingual ? `${cue.text}\n${tr}` : tr) : cue.text;
      return `${i + 1}\n${cue.time}\n${text}`;
    })
    .join('\n\n');
}
