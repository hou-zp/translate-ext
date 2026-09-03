# 介绍页（translate-ext site）

「AI 沉浸翻译」的交互式介绍单页：模拟浏览器里可实时体验整页双语、划词、悬停、
输入框三次空格翻译，并附功能矩阵、引擎路由表、安装步骤与 FAQ。

独立于扩展本体（不参与 WXT 构建，也不进扩展包），基于 Vite + React 19 + Tailwind 4，
`vite-plugin-singlefile` 会把产物内联成单个 `dist/index.html`（含图片），可直接扔到任何静态托管。

## 开发与构建

```bash
cd site
npm install
npm run dev        # 本地开发（HMR）
npm run build      # 产出单文件 dist/index.html
npm run preview    # 本地预览构建产物
npm run typecheck  # TypeScript 类型检查
```

> 根目录 `tsconfig.json` 已 `exclude: ["site"]`，扩展的类型检查不受影响。

## 内容说明

- 演示为**纯前端**：正文双语为内置句级语料（`src/data/content.ts`），不发起任何网络请求；
  真实扩展行为以仓库 README 为准。
- 品牌信息（名称 / 版本号 / 引擎表 / FAQ）集中在：
  - `src/data/content.ts` — 引擎表、统计、FAQ、演示语料
  - `src/components/Hero.tsx` / `InstallFaq.tsx` / `SettingsPage.tsx` — 品牌栏、安装步骤、页脚、关于卡片
- 升级扩展版本时记得同步 `v1.2.0` 相关字样。

## 部署

单文件 `dist/index.html` 可部署到任意静态托管：

- **GitHub Pages**：把 `site/dist` 推到 `gh-pages` 分支，或在仓库 Settings → Pages 指向该分支
- **Vercel / Netlify**：根目录设 `site/`，构建命令 `npm run build`，产物目录 `dist`
- **任何对象存储 / 自建服务器**：直接上传 `dist/index.html`
