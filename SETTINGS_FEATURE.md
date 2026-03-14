# 字体和主题设置功能

## 功能说明

实现了阅读器的字体和主题设置功能，支持：
- 字号调整（12-24px）
- 行距调整（1.2-2.5）
- 主题切换（日间/夜间）
- 设置持久化存储

## 实现文件

### 数据库层
- `src/database/schema.sql` - 添加 app_settings 表
- `src/database/repositories/settings.repository.ts` - 设置数据访问
- `src/database/repositories/settings.repository.test.ts` - 单元测试

### IPC 层
- `src/main/ipc/settings.handler.ts` - IPC 处理器
- `src/main/ipc/settings.handler.test.ts` - 单元测试
- `src/main/index.ts` - 注册 IPC handlers

### UI 层
- `src/renderer/src/pages/Settings.tsx` - 设置页面组件
- `src/renderer/src/styles/settings.css` - 主题样式

### 测试
- `src/tests/settings.integration.test.ts` - 集成测试

## 测试结果

✅ 所有 63 个测试通过
- Repository 层：4 个测试
- Handler 层：3 个测试
- 集成测试：2 个测试

## 使用方式

```typescript
// 保存设置
await window.electron.ipcRenderer.invoke('settings:save', 'fontSize', '18');

// 获取设置
const fontSize = await window.electron.ipcRenderer.invoke('settings:get', 'fontSize');

// 获取所有设置
const all = await window.electron.ipcRenderer.invoke('settings:getAll');
```

## CSS 变量

```css
--font-size: 字号
--line-height: 行距
--font-family: 字体
--bg-color: 背景色
--text-color: 文字色
```

主题通过 `[data-theme="dark"]` 切换。
