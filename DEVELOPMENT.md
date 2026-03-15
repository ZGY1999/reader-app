# Development Status

## 当前目标

当前实现已经完成 `v0.1 阅读底座公开试用版`、`v0.2 标注公开试用版`、`v0.3 AI 问书公开试用版` 和 `v0.4 TTS 公开试用版`。

## 已完成的版本闭环

- 统一了渲染层使用的 preload API
- `/`, `/reader`, `/settings` 路由已经连通
- `TXT / EPUB / PDF` 走统一导入和读取链路
- 阅读页使用统一 reading payload
- 设置页通过 `electronAPI.settings` 工作
- 阅读进度会保存并在重新打开书籍时恢复
- 书架页导入失败会显示错误信息
- 标注支持创建、渲染、持久化、恢复和显式删除
- 标注支持选区反馈、hover / active 状态、侧栏列表、章节分组和正文跳转
- AI 支持在设置页配置 API Key / Base URL
- 阅读页支持 AI 状态卡片、去设置引导、提问、回答展示和引用来源
- 设置页支持 TTS Voice / TTS Rate 配置
- 设置页会显示当前 AI / TTS 配置摘要，并明确“保存即生效”
- 阅读页支持 TTS 状态卡片、朗读、暂停、继续、停止和正文高亮跟随
- TTS 默认走 `tts:synthesize + HTMLAudio`，避免依赖旧的主进程播放器状态机
- 旧的 TTS Reader 组件与 `player:* / highlight:*` IPC 已移除
- 相关测试已经补齐并通过

## 当前验证结果

2026-03-15 全量验证结果：

- `36` 个测试文件通过
- `145` 项测试通过
- `npm run build` 通过
- `npm run build:electron` 通过

验证方式：

```bash
npm test -- --run
```

## 下一阶段优先级

1. 开始下一轮公开试用打磨
2. 再决定是否进入 UI 视觉升级
3. 为公开试用整理安装和反馈流程

## 已知技术限制

- 开发模式依赖 Vite 跑在 `5174` 端口
- PDF 解析测试有 warning，需要后续处理 `standardFontDataUrl`
- 根 `tsconfig` 已排除测试文件，生产构建只检查应用代码
- 当前 TTS 只保留 `tts:synthesize` 渲染侧播放链路
