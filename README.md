# Reader App

一个基于 Electron + React + TypeScript 的桌面阅读器项目。

当前主线已经完成 `v0.1 阅读底座公开试用版`、`v0.2 标注公开试用版` 和 `v0.3 AI 问书公开试用版`，下一步目标是 `v0.4 TTS 公开试用版`。

## 当前状态

截至 2026-03-15，当前代码库已经稳定覆盖这些能力：

- 支持导入 `TXT / EPUB / PDF`
- 书架页可展示已导入书籍并进入阅读页
- 阅读页可加载统一阅读 payload
- 目录可跳转到章节，滚动时会同步当前章节
- 设置页通过 preload API 读写设置，并立即作用到页面
- 阅读进度可保存和恢复
- 导入失败时书架页会给出错误提示
- 标注支持创建、渲染、持久化、恢复和显式删除
- 标注支持选区反馈、hover / active 状态、侧栏列表浏览、章节分组和正文定位跳转
- AI 支持在设置页配置 API Key / Base URL
- 阅读页支持 AI 提问、未配置降级提示、回答展示和引用来源
- 测试已通过 `167` 项

仍未达到公开试用版标准的模块：

- TTS 朗读闭环

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

## 当前版本边界

已完成：

- 书架可用
- 三种格式可读
- 阅读页主流程可用
- 设置生效
- 进度恢复可用
- 基础错误提示存在
- 标注闭环可用

当前下一步目标：

- `v0.4 TTS` 产品化

暂不在当前公开试用范围内：

- TTS 产品化
- UI 视觉重做

## 已知问题

- PDF 解析测试会输出 `standardFontDataUrl` warning，但测试结果通过
- 仓库中仍有部分 TTS 代码处于“模块存在、尚未形成公开试用闭环”的状态
