import JSZip from 'jszip';

export interface EpubChapter {
  title: string;
  paragraphs: string[];
}

export interface EpubBook {
  title: string;
  chapters: EpubChapter[];
}

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
}

function resolvePath(base: string, href: string): string {
  const parts = (base + href).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

/** Parse an EPUB (zip of XHTML) into chapters of plain-text paragraphs. */
export async function parseEpub(data: ArrayBuffer): Promise<EpubBook> {
  const zip = await JSZip.loadAsync(data);
  const parser = new DOMParser();

  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('无效的 EPUB：缺少 container.xml');
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const opfPath = containerDoc
    .querySelector('rootfile')
    ?.getAttribute('full-path');
  if (!opfPath) throw new Error('无效的 EPUB：找不到 OPF 文件');

  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) throw new Error('无效的 EPUB：无法读取 OPF');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  const opfDir = dirOf(opfPath);

  const bookTitle =
    opfDoc.getElementsByTagName('dc:title')[0]?.textContent?.trim() ||
    opfDoc.querySelector('title')?.textContent?.trim() ||
    'EPUB 文档';

  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, href);
  });

  const spineHrefs: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref');
    const href = idref ? manifest.get(idref) : undefined;
    if (href) spineHrefs.push(resolvePath(opfDir, decodeURIComponent(href)));
  });

  const chapters: EpubChapter[] = [];
  for (const href of spineHrefs) {
    const html = await zip.file(href)?.async('text');
    if (!html) continue;
    const doc = parser.parseFromString(html, 'text/html');
    const title =
      doc.querySelector('h1, h2, h3')?.textContent?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      href.split('/').pop() ||
      '章节';
    const paragraphs: string[] = [];
    doc
      .querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, dd, dt, figcaption')
      .forEach((el) => {
        const text = el.textContent?.replace(/\s+/g, ' ').trim();
        if (text && text.length >= 2) paragraphs.push(text);
      });
    if (paragraphs.length > 0) chapters.push({ title, paragraphs });
  }

  if (chapters.length === 0) throw new Error('EPUB 中没有可翻译的文本内容');
  return { title: bookTitle, chapters };
}
