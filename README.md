# AI 沉浸翻译（translate-ext）

一个功能完整的浏览器翻译扩展（Chrome / Edge / Firefox / Safari），对标"沉浸式翻译"类产品：

- **整页双语翻译**：视口优先、增量翻译动态内容（无限滚动 / SPA），行内链接与加粗样式保留，一键还原原文；支持双语对照与替换原文两种模式、5 种译文样式
- **翻译服务**：谷歌翻译（免费、开箱即用）、DeepL、微软（Azure）、OpenAI 兼容接口（OpenAI / DeepSeek / 各类网关）、**Ollama 本地大模型**
- **AI 专家**：通用 / 技术文档 / 学术论文 / 新闻 / 文学 / 法律 / 医学等系统提示词预设，支持自定义
- **AI 精翻**：先用当前服务快翻，再用 AI 模型按专家风格润色替换
- **划词翻译**：选中文字弹出气泡，支持复制、朗读、收藏到生词本
- **鼠标悬停翻译**：按住修饰键悬停即翻译该段
- **术语库**：命中术语强制使用指定译法（AI 服务走提示词注入，谷歌/DeepL/微软走占位符锁定），支持 CSV 导入导出
- **输入框翻译**：任意输入框输入母语后快速按 3 次空格，原地替换为目标语言（写外语邮件 / 评论 / 跨语言搜索）
- **生词本**：收藏的词句集中管理，一键导出 Anki 可导入的 CSV
- **YouTube 双语字幕**：读取视频字幕轨、按需分块翻译，在播放器上叠加原文 + 译文（全屏可用）
- **视频网站双语字幕（Beta）**：Netflix / B 站 / Coursera / Udemy / Prime Video / Disney+ / Vimeo，跟随播放器原生字幕逐条实时翻译并叠加显示
- **会议实时字幕翻译（Beta）**：Google Meet / Zoom 网页版 / Teams，开启平台自带 CC 字幕后自动翻译成目标语言（默认关闭，设置中开启）
- **漫画模式（实验）**：popup →「更多功能」→ 漫画模式，批量对页面大图做多模态 OCR + 翻译，译文叠加在每张图片下沿，再点一次退出
- **侧边栏**：popup →「更多功能」→ 侧边栏（Chrome/Edge），常驻面板包含当前页翻译控制 + 完整文本翻译
- **双引擎对比**：文本翻译页 / 侧边栏中开启「双引擎对比」，两个翻译服务并排输出，方便选服务
- **站点规则**：自动翻译 / 永不翻译名单之外，还支持每站点 CSS 选择器级「仅翻译 / 排除」规则、显示模式覆盖，以及远程规则订阅
- **AI 上下文翻译**：整页翻译前先让 AI 总结全文、提取关键术语，注入每批段落的提示词，减少代词与多义词误译
- **图片翻译**：右键任意图片 →「翻译图片中的文字」，用多模态模型（gpt-4o / Ollama llava 等）OCR + 翻译，气泡展示结果
- **文档翻译**：PDF（对照 / 叠加、扫描页 OCR、导出双语 HTML）、EPUB、DOCX、TXT / Markdown、SRT / ASS 字幕（可导出双语字幕），纯本地解析不上传
- **文本翻译**：双栏输入输出，AI 服务流式逐字输出，历史记录
- **云同步**：配置可随浏览器账号自动同步；完整配置 + 生词本可备份到 WebDAV 网盘（坚果云等）
- 页面悬浮球、右键菜单、键盘快捷键、译文缓存、配置导入导出、中英界面

## 开发

```bash
npm install        # 安装依赖（postinstall 自动执行 wxt prepare）
npm run dev        # Chrome 开发模式（HMR）
npm run dev:firefox
```

## 构建与打包

```bash
npm run build           # 构建 Chrome MV3 到 .output/chrome-mv3
npm run build:firefox   # 构建 Firefox
npm run build:safari    # 构建 Safari（再用 xcrun safari-web-extension-converter 封装为 App）
npm run zip             # 打包 Chrome 发布 zip
npm run zip:firefox
npm run zip:safari
npm run compile         # TypeScript 类型检查
npm test                # 核心逻辑 smoke 测试（jsdom）
npm run test:e2e        # 端到端：真实 Chromium 加载扩展翻译整页
node scripts/gen-icons.mjs  # 重新生成图标
```

本地加载：打开 `chrome://extensions` → 开启开发者模式 → 「加载已解压的扩展程序」→ 选择 `.output/chrome-mv3` 目录。

## 使用 Ollama 本地翻译

1. 安装并启动 [Ollama](https://ollama.com)，拉取一个模型（推荐指令跟随较好的模型）：

   ```bash
   ollama pull qwen2.5:7b
   ```

2. 允许浏览器扩展访问 Ollama（否则会被 CORS 拦截）：

   ```bash
   # macOS
   launchctl setenv OLLAMA_ORIGINS "*"
   # 然后重启 Ollama 应用

   # Linux (systemd)
   # 在 ollama.service 中加入 Environment="OLLAMA_ORIGINS=*"

   # Windows
   # 设置系统环境变量 OLLAMA_ORIGINS=* 后重启 Ollama
   ```

3. 在扩展「设置 → 翻译服务 → Ollama」中点击「测试连接」，从可用模型中选择模型即可。

## 各翻译服务配置

| 服务 | 需要配置 | 说明 |
| --- | --- | --- |
| 谷歌翻译 | 无 | 免费网页端接口，默认服务 |
| DeepL | API Key | 免费版 Key 以 `:fx` 结尾，自动切换免费端点 |
| 微软翻译 | Azure Key（+区域） | Azure Translator 资源，全球资源可不填区域 |
| OpenAI 兼容 | 地址 + Key + 模型 | 任何兼容 `/chat/completions` 的网关均可 |
| Ollama | 地址 + 模型 | 默认 `http://127.0.0.1:11434`，数据不出本机 |

## 技术栈与结构

WXT + React 19 + TypeScript + Tailwind CSS 4，pdf.js 解析 PDF，JSZip 解析 EPUB。

```
entrypoints/
  background.ts      # 调度中心：批量合并、并发限流、重试、缓存、精翻、流式端口、右键菜单
  content.ts         # 内容脚本入口（all_frames，含同源 iframe）
  popup/             # 主面板
  options/           # 设置页
  text-translate/    # 文本翻译页
  pdf-viewer/        # 文档翻译页（PDF/EPUB/TXT/SRT）
src/
  core/              # 配置、消息协议、缓存、队列、AI 专家 prompt、术语库、生词本、云同步、i18n
  providers/         # 五个翻译服务适配器 + LLM 批量翻译公共流程 + 多模态 vision 调用
  content/           # DOM 分段、双语回填、动态监听、悬停、划词、悬浮球、输入框翻译、图片翻译、YouTube 字幕
  doc/               # PDF 段落聚类（含扫描页 OCR）、EPUB/DOCX/SRT/ASS/TXT 解析
```

## 图片翻译、漫画模式与扫描 PDF 的模型要求

这三个功能走多模态（视觉）模型：

- **OpenAI 兼容**：模型需支持图片输入（如 `gpt-4o`、`gpt-4o-mini`、Qwen-VL 系列网关）
- **Ollama 本地**：需拉取视觉模型，如 `ollama pull llava` 或 `ollama pull qwen2.5vl`，并在设置中把 Ollama 模型切换为该模型

当前主服务是谷歌 / DeepL / 微软时，图片翻译自动改用「AI 精翻」里配置的模型服务。

漫画模式一次最多处理 30 张大图（并发 2），多模态调用较慢且计费较高，建议在确有需要的页面上使用。

## 视频 / 会议字幕说明

- YouTube 走字幕轨接口，可整段预读；其他视频网站与会议平台走「原生字幕 DOM 监听」：平台必须先显示自带字幕（CC），扩展才能捕获并翻译
- 各平台的字幕 DOM 结构可能随版本变化，适配器清单在 `src/content/video-captions.ts`，失效时更新选择器即可
- 会议字幕默认关闭（涉及会议内容外发到翻译服务），在「设置 → 通用」中开启

## 站点规则订阅格式

「设置 → 站点规则 → 规则订阅」接受一个返回 JSON 数组的 URL，每条规则字段：

```json
[
  {
    "pattern": "news.ycombinator.com",
    "excludeSelector": ".pagetop, .subtext",
    "includeSelector": "",
    "displayMode": "bilingual",
    "translationStyle": "underline"
  }
]
```

`pattern` 为 hostname（自动匹配子域名），其余字段可省略。本地规则优先于订阅规则。
