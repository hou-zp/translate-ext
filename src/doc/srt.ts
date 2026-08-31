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

/** Format a millisecond offset as an SRT timestamp (HH:MM:SS,mmm). */
export function msToSrtTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3600000);
  const m = Math.floor((clamped % 3600000) / 60000);
  const s = Math.floor((clamped % 60000) / 1000);
  const milli = clamped % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(milli, 3)}`;
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
