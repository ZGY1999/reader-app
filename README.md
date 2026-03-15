# Reader App

一个基于 Electron + React + TypeScript 的桌面阅读器项目。

当前主线目标是 `v0.1 阅读底座公开试用版`：先把 `TXT / EPUB / PDF` 的导入、阅读、设置、进度恢复做稳，再逐步补齐标注、AI 和 TTS。

## 当前状态

截至 2026-03-15，当前代码库已经稳定覆盖这些能力：

- 支持导入 `TXT / EPUB / PDF`
- 书架页可展示已导入书籍并进入阅读页
- 阅读页可加载统一阅读 payload
- 目录可跳转到章节，滚动时会同步当前章节
- 设置页通过 preload API 读写设置，并立即作用到页面
- 阅读进度可保存和恢复
- 导入失败时书架页会给出错误提示
- 测试已通过 `155` 项

这些模块已经存在，但还没有达到公开试用版标准：

- 标注完整闭环
- AI 问书闭环
- TTS 朗读闭环
- 更完整的阅读交互，例如章节点击跳转、复杂定位、统一分页体验

## 技术栈

- Electron
- React
- TypeScript
- sql.js
- Vitest
- epub.js
- pdfjs-dist

## 本地安装

```bash
npm install
```

## 开发方式

当前开发模式下，主进程会固定加载 `http://localhost:5174`，Vite 配置也已经固定在 `5174` 端口。

PowerShell 下推荐这样启动：

```powershell
# 终端 1
npm run dev:vite

# 终端 2
npm run build:electron
$env:NODE_ENV = 'development'
npx electron .
```

如果只想验证打包后的渲染层：

```powershell
npm run build
npm run build:electron
npx electron .
```

## 测试

```bash
npm test
```

## 当前 v0.1 范围

`v0.1` 只以阅读底座为验收标准：

- 书架可用
- 三种格式可读
- 阅读页主流程可用
- 设置生效
- 进度恢复可用
- 基础错误提示存在

不在 `v0.1` 验收范围内：

- 标注产品化
- AI 产品化
- TTS 产品化
- UI 视觉重做

## 已知问题

- PDF 解析测试会输出 `standardFontDataUrl` warning，但测试结果通过
- 仓库中仍有部分 AI / TTS / 标注代码处于“模块存在、尚未形成公开试用闭环”的状态
