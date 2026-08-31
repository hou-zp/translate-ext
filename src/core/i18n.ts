import { browser } from 'wxt/browser';

/**
 * UI i18n: Chinese strings are used directly as keys; the dictionary maps them
 * to English. Unknown keys fall back to the Chinese original, so the zh UI can
 * never break because of a missing entry.
 */
const EN: Record<string, string> = {
  自动检测: 'Auto Detect',
  翻译服务: 'Service',
  'AI 专家': 'AI Expert',
  '启用 AI 精翻': 'AI Refine',
  翻译当前页面: 'Translate This Page',
  显示原文: 'Show Original',
  文档翻译: 'Documents',
  文本翻译: 'Text',
  鼠标悬停: 'Hover',
  划词翻译: 'Selection',
  设置: 'Settings',
  更多功能: 'More',
  清空缓存: 'Clear Cache',
  快捷键: 'Shortcuts',
  站点规则: 'Site Rules',
  正在翻译: 'Translating',
  翻译失败: 'Translation failed',
  '此页面不支持翻译，请在普通网页中使用': 'This page cannot be translated. Try a normal web page.',
  '已加入永不翻译列表': 'Added to never-translate list',
  复制: 'Copy',
  已复制: 'Copied',
  朗读: 'Speak',
  关闭: 'Close',
  翻译本页: 'Translate page',
  '关闭本站翻译': 'Disable on this site',
  目标: 'Target',
  服务: 'Service',
  双语对照: 'Bilingual',
  替换原文: 'Replace',
  点击重试: 'Click to retry',
  收藏: 'Save',
  已收藏: 'Saved',
  图片翻译: 'Image Translation',
  正在识别图片文字: 'Reading text in image',
  图片中未识别到文字: 'No text found in the image',
  '图片翻译需要多模态模型（如 gpt-4o 或 Ollama llava）':
    'Image translation needs a multimodal model (e.g. gpt-4o or Ollama llava)',
  输入框翻译: 'Input Translation',
  'YouTube 字幕': 'YouTube Subtitles',
  术语库: 'Glossary',
  生词本: 'Vocabulary',
  漫画模式: 'Manga Mode',
  侧边栏: 'Side Panel',
  视频字幕: 'Video Subtitles',
  会议字幕: 'Meeting Captions',
  双引擎对比: 'Compare Engines',
  对比引擎: 'Second engine',
  已开启漫画模式: 'Manga mode on',
  已关闭漫画模式: 'Manga mode off',
  正在识别: 'Recognizing',
  张图片: 'images',
  当前页面: 'Current Page',
  '此浏览器不支持侧边栏': 'Side panel is not supported in this browser',
};

let uiLang = 'zh';
try {
  const l = browser.i18n?.getUILanguage?.() ?? navigator.language;
  uiLang = l?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
} catch {
  uiLang = 'zh';
}

export function t(zh: string): string {
  if (uiLang === 'zh') return zh;
  return EN[zh] ?? zh;
}

export function isChineseUI(): boolean {
  return uiLang === 'zh';
}
