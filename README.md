# 智能阅读器 Reader App

一款基于Electron的智能阅读应用，支持多种格式、AI问答、TTS朗读等功能。

## ✨ 功能特性

### 📚 多格式支持
- TXT文本文件（自动编码检测：UTF-8、GBK、GB2312）
- EPUB电子书
- PDF文档

### 🎯 核心功能
- **智能阅读界面**：目录导航、章节跳转
- **标注系统**：高亮、下划线、波浪线标注
- **全文搜索**：快速定位内容
- **阅读进度**：自动保存阅读位置

### 🤖 AI功能
- **智能问答**：基于RAG的AI对话
- **向量检索**：智能内容检索
- **反幻觉机制**：确保回答准确性

### 🔊 TTS朗读
- **语音合成**：Edge TTS引擎
- **播放控制**：播放/暂停/停止
- **实时高亮**：朗读位置跟随

### ⚙️ 个性化设置
- 字体大小调整
- 主题切换
- 阅读偏好设置

## 🛠️ 技术栈

- **框架**：Electron + React + TypeScript
- **数据库**：sql.js (SQLite)
- **搜索**：FlexSearch
- **TTS**：msedge-tts
- **AI**：OpenAI API兼容接口
- **测试**：Vitest (138个测试全部通过)

## 📦 安装

```bash
# 克隆仓库
git clone https://github.com/ZGY1999/reader-app.git
cd reader-app

# 安装依赖
npm install
```

## 🚀 开发

```bash
# 终端1：启动Vite dev server
npm run dev:vite

# 终端2：编译并启动Electron
npm run build:electron
NODE_ENV=development npx electron .
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行测试并查看覆盖率
npm run test:ui
```

## 📖 使用说明

1. **导入书籍**：点击"导入书籍"按钮，选择TXT/EPUB/PDF文件
2. **开始阅读**：在书架中点击书籍封面进入阅读界面
3. **使用功能**：
   - 左侧目录：快速跳转章节
   - 标注工具：选中文字后使用工具栏标注
   - TTS朗读：点击底部播放按钮开始朗读
   - 搜索：顶部搜索框快速查找内容

## 🔧 配置AI功能

在环境变量中配置OpenAI API：

```bash
export OPENAI_API_KEY=your_api_key
export OPENAI_BASE_URL=https://api.openai.com/v1
```

## 📁 项目结构

```
reader-app/
├── src/
│   ├── main/           # Electron主进程
│   ├── preload/        # 预加载脚本
│   ├── renderer/       # React渲染进程
│   ├── database/       # 数据库层
│   ├── services/       # 业务服务
│   └── utils/          # 工具函数
├── tests/              # 测试文件
└── dist/               # 编译输出
```

## 📝 开发特性

- ✅ 测试驱动开发（TDD）
- ✅ TypeScript类型安全
- ✅ 138个单元测试全部通过
- ✅ 性能优化（LRU缓存）
- ✅ 安全的IPC通信

## 📄 许可证

MIT License

## 👨‍💻 作者

ZGY1999
```
