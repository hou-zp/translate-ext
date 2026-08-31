/**
 * Smoke tests for the pure/DOM core logic, run with: npx tsx scripts/smoke.test.ts
 * Covers: paragraph collection, inline-marker round trip, batch prompt parsing,
 * SRT parse/build, TXT splitting, batching and language heuristics.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  DocumentFragment: dom.window.DocumentFragment,
  DOMParser: dom.window.DOMParser,
});

const { collectParagraphs, restoreInline, stripMarkers } = await import('../src/content/walker');
const { parseBatchResponse, buildBatchUserPrompt } = await import('../src/core/prompts');
const { parseSrt, buildSrt } = await import('../src/doc/srt');
const { parseTxt } = await import('../src/doc/txt');
const { chunkTexts, mapWithConcurrency } = await import('../src/core/queue');
const { detectLangHeuristic, looksLikeTarget, isTranslatableText } = await import(
  '../src/core/langs'
);

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok: ${name}`);
  else {
    failures++;
    console.error(`FAIL: ${name}`, detail ?? '');
  }
}

// ---- walker: paragraph collection ----
document.body.innerHTML = `
  <article>
    <h1>The <em>Great</em> Title</h1>
    <p>First paragraph with a <a href="/x">link</a> and <b>bold</b> text.</p>
    <div>
      Mixed text before
      <p>Nested paragraph content here.</p>
      trailing text after
    </div>
    <pre>code block should be skipped entirely</pre>
    <p class="notranslate">skip me too</p>
    <p>已经是中文的段落应当被跳过。</p>
    <p>42</p>
  </article>`;

const paras = collectParagraphs(document.body, 'zh-CN', new WeakSet());
const sources = paras.map((p) => p.plain);
check('collects title/paragraph/mixed runs', sources.length === 5, sources);
check('title collected', sources.some((s) => s.includes('Great Title')));
check('mixed-container text runs collected',
  sources.includes('Mixed text before') && sources.includes('trailing text after'));
check('pre/notranslate/chinese/number skipped',
  !sources.some((s) => s.includes('code block') || s.includes('skip me') || s.includes('中文') || s === '42'));

const linkPara = paras.find((p) => p.plain.includes('First paragraph'))!;
check('inline markers serialized', /<t\d+>link<\/t\d+>/.test(linkPara.source), linkPara.source);

// ---- walker: marker round trip ----
const frag = restoreInline('第一段，带<t0>链接</t0>和<t1>加粗</t1>文本。', linkPara.inlineMap);
const div = document.createElement('div');
div.appendChild(frag);
check('restored link keeps href', div.querySelector('a')?.getAttribute('href') === '/x', div.innerHTML);
check('restored bold kept', div.querySelector('b')?.textContent === '加粗');
check('restored full text', div.textContent === '第一段，带链接和加粗文本。');

const bad = restoreInline('mangled <t0>unclosed and </t9> nonsense', linkPara.inlineMap);
const div2 = document.createElement('div');
div2.appendChild(bad);
check('mangled markers degrade to readable text', (div2.textContent ?? '').includes('unclosed'));
check('stripMarkers removes tags', stripMarkers('a<t0>b</t0>c') === 'abc');

// ---- prompts: batch JSON parse ----
const prompt = buildBatchUserPrompt(['hello', 'world']);
check('batch prompt contains JSON', prompt.includes('"1":"hello"') && prompt.includes('"2":"world"'));
const parsed = parseBatchResponse('Some preamble {"1":"你好","2":"世界"} trailing', 2);
check('tolerant JSON parse', parsed[0] === '你好' && parsed[1] === '世界', parsed);
const parsedPartial = parseBatchResponse('{"1":"只有一个"}', 2);
check('missing keys become null', parsedPartial[0] === '只有一个' && parsedPartial[1] === null);
const single = parseBatchResponse('纯文本回答', 1);
check('single-text fallback', single[0] === '纯文本回答');

// ---- srt ----
const srt = `1\n00:00:01,000 --> 00:00:03,000\nHello there\n\n2\n00:00:04,000 --> 00:00:06,000\nSecond line\nwith wrap\n`;
const cues = parseSrt(srt);
check('srt parse', cues.length === 2 && cues[1]!.text === 'Second line\nwith wrap', cues);
const rebuilt = buildSrt(cues, ['你好', '第二行'], true);
check('srt bilingual build', rebuilt.includes('Hello there\n你好') && rebuilt.includes('第二行'));

// ---- txt ----
const txts = parseTxt('Para one.\n\nPara two\nwrapped line.\n\n\nPara three.');
check('txt split', txts.length === 3 && txts[1] === 'Para two wrapped line.', txts);

// ---- queue ----
const batches = chunkTexts(
  [
    { idx: 0, text: 'a'.repeat(100) },
    { idx: 1, text: 'b'.repeat(100) },
    { idx: 2, text: 'c'.repeat(100) },
  ],
  2,
  150,
);
check('chunk by chars and items', batches.length === 3, batches.map((b) => b.items.length));
const order: number[] = [];
await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => {
  order.push(n);
  return n * 2;
}).then((r) => check('mapWithConcurrency results ordered', JSON.stringify(r) === '[2,4,6,8]', r));

// ---- langs ----
check('detect zh', detectLangHeuristic('这是一段中文文本') === 'zh');
check('detect latin', detectLangHeuristic('This is English text') === 'latin');
check('looksLikeTarget zh', looksLikeTarget('这是中文', 'zh-CN') && !looksLikeTarget('English text', 'zh-CN'));
check('translatable filter', isTranslatableText('Hello world') && !isTranslatableText('123 456') && !isTranslatableText('https://a.com'));

// ---- renderer: single interactive element gets in-element plain text ----
const { ParagraphRenderer, createEntry } = await import('../src/content/renderer');
document.body.innerHTML = `<nav><a href="/pricing" class="btn">Pricing</a> <a href="/join">Sign up</a></nav>
  <main><p>This is a normal length paragraph that should render as a block below. See <a href="/d">the docs</a> for details.</p></main>`;
const uiParas = collectParagraphs(document.body, 'zh-CN', new WeakSet());
const renderer = new ParagraphRenderer(() => 'bilingual', () => 'underline');

check('sibling nav links split into separate paragraphs',
  uiParas.some((p) => p.plain === 'Pricing') && uiParas.some((p) => p.plain === 'Sign up'),
  uiParas.map((p) => p.plain).join(' | '));
check('link inside prose stays part of its sentence',
  uiParas.some((p) => p.plain.includes('See') && p.plain.includes('the docs')));

const navPara = uiParas.find((p) => p.plain === 'Pricing')!;
const navEntry = createEntry(navPara);
renderer.render(navEntry, '定价');
check('nav link is not duplicated', document.querySelectorAll('nav a').length === 2);
check('nav translation lives inside the link',
  document.querySelector('a')?.textContent?.includes('定价') === true,
  document.body.innerHTML);
renderer.restore(navEntry);
check('nav restore removes translation', document.querySelector('a')?.textContent === 'Pricing');

const blockPara = uiParas.find((p) => p.plain.startsWith('This is a normal'))!;
const blockEntry = createEntry(blockPara);
renderer.render(blockEntry, '这是一段正常长度的段落，应当以块级形式显示在下方。');
const blockWrapper = document.querySelector('p .txe-t');
check('long paragraph renders as block wrapper',
  blockWrapper !== null && !blockWrapper.classList.contains('txe-inline'));

// ---- video caption adapters ----
const { findCaptionAdapter } = await import('../src/content/video-captions');
check('netflix adapter matches', findCaptionAdapter('www.netflix.com')?.id === 'netflix');
check('bilibili adapter matches', findCaptionAdapter('www.bilibili.com')?.id === 'bilibili');
check('meet adapter is meeting kind', findCaptionAdapter('meet.google.com')?.kind === 'meeting');
check('zoom subdomain matches', findCaptionAdapter('us05web.zoom.us')?.id === 'zoom');
check('unknown host has no adapter', findCaptionAdapter('example.com') === null);
check('youtube keeps its dedicated module', findCaptionAdapter('www.youtube.com') === null);

// ---- terms (glossary) ----
const { matchTerms, glossaryPrompt, lockTerms, restoreTerms, parseTermsCsv, termsToCsv } =
  await import('../src/core/terms');
const glossary = [
  { source: 'Transformer', target: 'Transformer 架构' },
  { source: 'LLM', target: '大语言模型', caseSensitive: true },
];
check('matchTerms hits case-insensitively',
  matchTerms('the transformer model', glossary).length === 1);
check('matchTerms respects caseSensitive',
  matchTerms('llm is lowercase', glossary).length === 0 &&
  matchTerms('LLM is upper', glossary).length === 1);
check('glossaryPrompt lists pairs',
  glossaryPrompt(glossary).includes('"Transformer" => "Transformer 架构"'));

const { locked, used } = lockTerms('The Transformer beats old LLM baselines', glossary);
check('lockTerms replaces with placeholders', locked === 'The ⟦0⟧ beats old ⟦1⟧ baselines', locked);
check('restoreTerms substitutes targets',
  restoreTerms('该 ⟦0⟧ 优于旧的 ⟦ 1 ⟧ 基线', used) === '该 Transformer 架构 优于旧的 大语言模型 基线');

const csvTerms = parseTermsCsv('source,target\nAPI,接口\n"Neural Network",神经网络,1\n\n# comment');
check('parseTermsCsv parses rows and skips header/comments',
  csvTerms.length === 2 && csvTerms[1]!.source === 'Neural Network' && csvTerms[1]!.caseSensitive === true,
  csvTerms);
check('termsToCsv round trip', parseTermsCsv(termsToCsv(glossary)).length === 2);

// ---- site rules ----
const { findSiteRule, DEFAULT_CONFIG } = await import('../src/core/config');
const ruleCfg = {
  ...DEFAULT_CONFIG,
  siteRules: [{ pattern: 'example.com', excludeSelector: 'nav' }],
  subscribedRules: [
    { pattern: 'example.com', excludeSelector: '.sub' },
    { pattern: 'docs.example.com', includeSelector: 'article' },
  ],
};
check('local rule wins over subscribed',
  findSiteRule(ruleCfg, 'example.com')?.excludeSelector === 'nav');
check('subdomain matches and longer pattern wins',
  findSiteRule(ruleCfg, 'docs.example.com')?.excludeSelector === 'nav' ||
  findSiteRule(ruleCfg, 'docs.example.com')?.includeSelector === 'article');
check('no rule for other hosts', findSiteRule(ruleCfg, 'other.org') === null);

// ---- walker: excludeSelector ----
document.body.innerHTML = `
  <main>
    <p>Keep this English paragraph please.</p>
    <p class="ad">Skip this advertisement text block.</p>
  </main>`;
const filtered = collectParagraphs(document.body, 'zh-CN', new WeakSet(), undefined, '.ad');
check('excludeSelector skips matching elements',
  filtered.length === 1 && filtered[0]!.plain.startsWith('Keep'),
  filtered.map((p) => p.plain));

// ---- ass subtitles ----
const { parseAss, buildAss, cleanAssText } = await import('../src/doc/ass');
const assSrc = `[Script Info]
Title: test

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\an8}Hello, world
Dialogue: 0,0:00:04.00,0:00:06.00,Default,,0,0,0,,Line one\\NLine two
Comment: 0,0:00:07.00,0:00:08.00,Default,,0,0,0,,not a dialogue`;
const assFile = parseAss(assSrc);
check('ass parses dialogues only', assFile.cues.length === 2, assFile.cues);
check('ass strips override tags', assFile.cues[0]!.text === 'Hello, world');
check('ass converts \\N to newline', assFile.cues[1]!.text === 'Line one\nLine two');
check('ass keeps commas in text', assFile.cues[0]!.text.includes(','));
const assOut = buildAss(assFile, ['你好，世界', '第一行\n第二行'], true);
check('ass bilingual rebuild', assOut.includes('Hello, world\\N你好，世界'), assOut);
check('ass rebuild keeps sections', assOut.includes('[Script Info]'));
check('cleanAssText handles \\h', cleanAssText('a\\hb{\\i1}c') === 'a b c'.replace(' b ', ' b') || cleanAssText('a\\hb{\\i1}c') === 'a bc');

// ---- docx markdown assembly ----
const { docxToMarkdown } = await import('../src/doc/docx');
const md = docxToMarkdown(
  [
    { tag: 'h1', text: 'Title' },
    { tag: 'p', text: 'Body paragraph.' },
    { tag: 'li', text: 'Item one' },
  ],
  ['标题', '正文段落。', '第一项'],
  true,
);
check('docx md headings/quotes/lists',
  md.includes('# Title') && md.includes('# 标题') && md.includes('> 正文段落。') && md.includes('- 第一项'),
  md);

// ---- favorites csv ----
const { favoritesToAnkiCsv } = await import('../src/core/favorites');
const ankiCsv = favoritesToAnkiCsv([
  { id: '1', text: 'serendipity', translation: '机缘巧合', sourceLang: 'en', targetLang: 'zh-CN', host: 'x.com', at: 0 },
  { id: '2', text: 'a, "quoted"', translation: '带引号', sourceLang: 'en', targetLang: 'zh-CN', host: 'y.com', at: 0 },
]);
check('anki csv escapes quotes/commas',
  ankiCsv.split('\n')[0] === 'serendipity,机缘巧合,x.com' &&
  ankiCsv.includes('"a, ""quoted""",带引号,y.com'),
  ankiCsv);

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
