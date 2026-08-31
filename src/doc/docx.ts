import mammoth from 'mammoth';

export interface DocxBlock {
  /** html tag of the block (p, h1..h6, li, td) */
  tag: string;
  text: string;
}

/** Parse a .docx file into a flat list of translatable text blocks. */
export async function parseDocx(buffer: ArrayBuffer): Promise<DocxBlock[]> {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks: DocxBlock[] = [];
  const els = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th');
  els.forEach((el) => {
    // skip elements that only wrap other collected blocks (e.g. li > p)
    if (el.querySelector('p, h1, h2, h3, h4, h5, h6, li')) return;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    blocks.push({ tag: el.tagName.toLowerCase(), text });
  });
  return blocks;
}

/** Assemble a Markdown document from the blocks and their translations. */
export function docxToMarkdown(
  blocks: DocxBlock[],
  translations: (string | null)[],
  bilingual: boolean,
): string {
  const out: string[] = [];
  blocks.forEach((b, i) => {
    const tr = translations[i];
    const heading = /^h([1-6])$/.exec(b.tag);
    const prefix = heading ? '#'.repeat(Number(heading[1])) + ' ' : b.tag === 'li' ? '- ' : '';
    if (bilingual) {
      out.push(`${prefix}${b.text}`);
      // keep the same block type for headings/lists; quote plain paragraphs
      if (tr) out.push(prefix ? `${prefix}${tr}` : `> ${tr}`);
    } else {
      out.push(`${prefix}${tr ?? b.text}`);
    }
  });
  return out.join('\n\n');
}
