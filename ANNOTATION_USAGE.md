# 标注系统使用说明

## 功能概述
标注系统支持对文本进行三种样式的标注：直线、波浪线、高亮。

## 已实现的功能

### 1. 数据库层 (annotation.repository.ts)
- `add()` - 添加标注
- `findById()` - 根据 ID 查找标注
- `findByBookId()` - 获取书籍的所有标注
- `delete()` - 删除标注

### 2. IPC 层 (annotation.handler.ts)
- `createAnnotation()` - 创建标注
- `getAnnotations()` - 获取标注列表
- `deleteAnnotation()` - 删除标注

### 3. UI 组件

#### AnnotationToolbar
工具栏组件，提供三个标注按钮。

```tsx
import AnnotationToolbar from './components/AnnotationToolbar';

<AnnotationToolbar onAnnotate={(style) => {
  // style: 'underline' | 'wavy' | 'highlight'
}} />
```

#### TextRenderer
文本渲染组件，支持标注显示和文本选择。

```tsx
import TextRenderer from './components/TextRenderer';
import './components/annotation.css';

<TextRenderer
  content="文本内容"
  annotations={[
    { id: '1', startOffset: 0, endOffset: 4, text: '文本', style: 'underline' }
  ]}
  onAnnotate={(data) => {
    // data: { startOffset, endOffset, text }
  }}
/>
```

## 标注样式

- `underline` - 蓝色直线
- `wavy` - 绿色波浪线
- `highlight` - 黄色高亮

## 测试覆盖

✅ 所有 53 个测试通过
- Repository 层测试：3 个
- Handler 层测试：3 个
- UI 组件测试：6 个
- 集成测试：1 个
