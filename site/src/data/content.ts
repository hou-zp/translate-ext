export type Block = {
  id: string;
  kind: "title" | "deck" | "p" | "quote";
  en: string[];
  zh: string[];
};

export const ARTICLE = {
  pub: "THE READING ROOM",
  issue: "ESSAY · No.47",
  author: "Mara Ellison",
  date: "Feb 11, 2026",
  read: "12 min read",
  url: "reading.room/essays/why-we-still-read",
  blocks: [
    {
      id: "title",
      kind: "title",
      en: ["Why We Still Read"],
      zh: ["我们为何仍然阅读"],
    },
    {
      id: "deck",
      kind: "deck",
      en: ["On attention, translation, and the quiet machinery of borrowing another mind."],
      zh: ["论注意力、翻译，以及借用他人心智的那台安静机器。"],
    },
    {
      id: "p1",
      kind: "p",
      en: [
        "Every evening, at the exact hour when the streetlights stutter on, Ana Reyes opens a book the way other people open a window.",
        "She does not scroll, skim, or search; she reads the way a swimmer enters cold water, one breath at a time.",
        "In an economy built to fracture attention, this ordinary ritual looks increasingly like a quiet act of resistance.",
      ],
      zh: [
        "每天晚上，街灯恰好开始闪烁的那个时刻，安娜·雷耶斯会打开一本书，就像其他人推开一扇窗。",
        "她不刷屏、不略读、也不检索；她阅读的方式就像游泳者进入冷水，一次只换一口气。",
        "在一个以撕裂注意力为生的经济体系里，这种平凡的仪式越来越像一种安静的抵抗。",
      ],
    },
    {
      id: "p2",
      kind: "p",
      en: [
        "Neuroscientists now describe reading as a kind of borrowed cognition.",
        "The brain recycles circuits originally evolved for vision and speech, wiring them together into a new skill that no genome anticipates.",
        "Which means every reader is a prototype, and every book a machine for rebuilding a mind.",
      ],
      zh: [
        "神经科学家如今把阅读描述为一种「借来的认知」。",
        "大脑回收了最初为视觉与语言演化的回路，把它们重新接成一项任何基因组都未曾预料的新技能。",
        "这意味着每位读者都是原型机，而每本书都是一台重建心智的机器。",
      ],
    },
    {
      id: "quote",
      kind: "quote",
      en: ["A sentence is the only technology that lets you think someone else's thought from the inside."],
      zh: ["句子是唯一一种能让你从内部去思考他人思想的技术。"],
    },
    {
      id: "p3",
      kind: "p",
      en: [
        "The evidence for deep reading's benefits is quieter than its champions claim, but stranger.",
        "Follow a character through four hundred pages and you rehearse intentions that are never your own.",
        "Psychologists call it narrative transport; readers have always called it going somewhere.",
      ],
      zh: [
        "关于深度阅读益处的证据，比拥护者宣称的更低调，也更奇妙。",
        "跟随一个角色走过四百页纸，你便在排演那些永远不属于你的意图。",
        "心理学家称之为「叙事传输」；而读者一直管它叫「去某个地方」。",
      ],
    },
    {
      id: "p4",
      kind: "p",
      en: [
        "Translation multiplies the places a reader can go.",
        "Yet the classic trade-off is brutal: fluency or friction, the author's voice or your own comprehension, never both at once.",
        "Bilingual pages refuse that trade-off, keeping the original line within reach of the translated one.",
      ],
      zh: [
        "翻译成倍地扩展了读者能去的地方。",
        "然而经典的取舍是残酷的：流利或摩擦，作者的声音或你自己的理解，永远不能同时拥有。",
        "双语页面拒绝了这种取舍，让原文始终停留在译文伸手可及之处。",
      ],
    },
    {
      id: "p5",
      kind: "p",
      en: [
        "There is a craft to reading alongside a translation.",
        "You learn to notice what a sentence costs: the idiom that survives, the joke that drowns, the rhythm that refuses to cross any border.",
        "The gap between the two languages becomes the most interesting text on the screen.",
      ],
      zh: [
        "对照译文阅读是一门手艺。",
        "你学会留意一句话的代价：哪些习语活了下来，哪些笑话沉入水底，哪些节奏拒绝跨越任何边界。",
        "两种语言之间的缝隙，成为屏幕上最有趣的文本。",
      ],
    },
    {
      id: "p6",
      kind: "p",
      en: [
        "Critics worry that instant translation makes readers lazy, that the friction was the point.",
        "But friction was never the point; contact was.",
        "A ladder removed from a wall does not prove the climbing was virtuous — it only guarantees the roof stays empty.",
      ],
      zh: [
        "批评者担心即时翻译会让读者变懒，担心摩擦本身才是意义所在。",
        "但摩擦从来不是意义所在；接触才是。",
        "从墙上撤走梯子并不能证明攀爬多么高尚——它只保证屋顶永远空着。",
      ],
    },
    {
      id: "p7",
      kind: "p",
      en: [
        "So Ana reads on, two languages stacked like sediment, one line of English above its Chinese shadow.",
        "When she finally closes the book, the streetlights are still on, and something in her vocabulary has quietly moved house.",
      ],
      zh: [
        "于是安娜继续读下去，两种语言像沉积物一样叠放，一行英文悬在它中文的影子之上。",
        "当她最终合上书，街灯依旧亮着，而她词汇里的某些东西已经悄悄地搬了家。",
      ],
    },
  ] as Block[],
};

/** 输入框翻译示例（含离线译文） */
export const INPUT_SAMPLES: { en: string; zh: string }[] = [
  {
    en: "The margins of my books are more honest than my diary.",
    zh: "我书页边空白处的批注，比我的日记更诚实。",
  },
  {
    en: "Reading is talking with the dead on their best days.",
    zh: "阅读，是在逝者状态最好的日子里与他们交谈。",
  },
  {
    en: "I lend books the way other people lend money, and grieve in exactly the same way.",
    zh: "我借书的方式就像别人借钱，并且以一模一样的方式哀悼它们的去向。",
  },
];

export type TargetCode = "zh-CN" | "zh-TW" | "ja" | "ko" | "en" | "fr";

export const TARGETS: { code: TargetCode; label: string; offline: boolean }[] = [
  { code: "zh-CN", label: "简体中文", offline: true },
  { code: "zh-TW", label: "繁體中文", offline: false },
  { code: "ja", label: "日本語", offline: false },
  { code: "ko", label: "한국어", offline: false },
  { code: "en", label: "English", offline: false },
  { code: "fr", label: "Français", offline: false },
];

export const ENGINES = [
  { name: "Google 翻译", note: "免费 · 开箱即用", langs: "133", ms: 260, bar: 88, free: "免费", lit: 3 },
  { name: "DeepL", note: "API v2", langs: "31", ms: 420, bar: 72, free: "50 万字符 / 月", lit: 4 },
  { name: "微软 Azure", note: "translator", langs: "100+", ms: 380, bar: 76, free: "200 万字符 / 月", lit: 4 },
  { name: "OpenAI 兼容", note: "OpenAI / DeepSeek / 网关", langs: "100+", ms: 820, bar: 44, free: "按量付费", lit: 5 },
  { name: "Ollama", note: "本地大模型", langs: "100+", ms: 1200, bar: 30, free: "完全免费 · 本地", lit: 5 },
];

export const FAQS = [
  {
    q: "这个扩展和「沉浸式翻译」是什么关系？",
    a: "translate-ext 是一个功能对标沉浸式翻译的开源实现：整页双语、划词、悬停、输入框翻译、YouTube 双语字幕、PDF / EPUB / DOCX 文档翻译、术语库、生词本、WebDAV 云同步等能力均已内置，且完全免费开源、支持接入你自己的翻译服务。",
  },
  {
    q: "页面演示里的翻译，是真实调用还是写死的？",
    a: "本介绍页是纯前端演示：正文文章使用内置的双语语料（句级对齐），因此离线即可秒出译文；真实的扩展在浏览器中会调用你配置的翻译服务（谷歌 / DeepL / 微软 / OpenAI 兼容 / Ollama），并有译文缓存与失败重试。",
  },
  {
    q: "我的数据安全吗？",
    a: "译文请求由浏览器直接发往你所配置的翻译服务，不经过任何中间服务器；文档翻译（PDF / EPUB / DOCX）为纯本地解析，不上传文件；Ollama 方案可以把整条链路留在本机。配置与生词本存在本地，可选 WebDAV 备份到自己的网盘。",
  },
  {
    q: "支持哪些浏览器？",
    a: "Chrome、Edge、Firefox、Safari 四端均支持（Safari 需用 safari-web-extension-converter 封装为 App）。核心功能为 Manifest V3，浏览器需要较新的版本。",
  },
  {
    q: "Ollama 本地大模型怎么用？",
    a: "安装 Ollama 并拉取模型（如 qwen2.5:7b），设置 OLLAMA_ORIGINS=* 允许扩展访问，然后在「设置 → 翻译服务 → Ollama」点击测试连接、选择模型即可。适合有隐私要求或想省 API 费用的用户，AI 专家与 AI 精翻同样可用。",
  },
  {
    q: "双语对照的样式可以自定义到什么程度？",
    a: "演示开放了三个维度：分隔符（无 / 细线 / 虚线）、译文配色（朱砂 / 黛青 / 墨灰 / 赭金）、译文字体（衬线 / 无衬线），并支持「双语对照 / 仅译文 / 原文」三种显示模式。真实扩展还提供 5 种译文样式与译文位置、字号设置，所有选项在上方模拟浏览器中即时生效。",
  },
];

/** 句级离线语料索引：用于划词 / 输入框的离线回退 */
const corpus = ARTICLE.blocks.map((b) => {
  const offsets: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const s of b.en) {
    offsets.push({ start: cursor, end: cursor + s.length });
    cursor += s.length + 1; // joined by single space
  }
  return { block: b, en: b.en.join(" "), offsets };
});

export function offlineTranslate(selection: string): string | null {
  const sel = selection.replace(/\s*\n\s*/g, " ").trim();
  if (sel.length < 3) return null;
  for (const entry of corpus) {
    const idx = entry.en.indexOf(sel);
    if (idx === -1) continue;
    const end = idx + sel.length;
    const parts: string[] = [];
    entry.offsets.forEach((o, i) => {
      if (o.end > idx && o.start < end) parts.push(entry.block.zh[i]);
    });
    if (parts.length) return parts.join("");
  }
  // 完整匹配输入示例
  const sample = INPUT_SAMPLES.find((s) => s.en.trim() === sel.trim());
  return sample ? sample.zh : null;
}

export const STATS = [
  { k: "5", v: "翻译服务" },
  { k: "13+", v: "功能模块" },
  { k: "4", v: "适配浏览器" },
  { k: "0", v: "中间服务器" },
];
