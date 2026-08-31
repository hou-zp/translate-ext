/** Split plain text into paragraphs (blank-line separated, long-line aware). */
export function parseTxt(content: string): string[] {
  return content
    .replace(/\r/g, '')
    .split(/\n{2,}|(?<=[。！？.!?])\n(?=\S)/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2);
}

/** Trigger a client-side file download. */
export function downloadText(filename: string, content: string, mime = 'text/plain'): void {
  const blob = new Blob(['\ufeff' + content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
