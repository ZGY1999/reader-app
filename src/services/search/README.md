# 全文搜索功能使用说明

## 功能概述
基于 FlexSearch 实现的全文搜索功能，支持中文搜索和模糊匹配。

## 使用方法

### 1. SearchService - 简单搜索
```typescript
import { SearchService } from './services/search';

const searchService = new SearchService();

// 构建索引
await searchService.buildIndex('book1', '这是一本关于人工智能的书籍');

// 搜索
const results = await searchService.search('book1', '人工智能');
// 返回: [{ text: '人工智能', position: 7 }]
```

### 2. IndexBuilder - 分段搜索
```typescript
import { IndexBuilder } from './services/search';

const indexBuilder = new IndexBuilder();

// 分段构建索引
const chunks = ['第一章', '第二章：机器学习', '第三章'];
await indexBuilder.buildFromChunks('book1', chunks);

// 搜索返回分段信息
const results = await indexBuilder.search('book1', '机器学习');
// 返回: [{ text: '第二章：机器学习', chunkIndex: 1, position: 4 }]
```

## 测试覆盖
- ✅ 索引构建
- ✅ 搜索准确性
- ✅ 模糊搜索
- ✅ 分段索引
- ✅ 中文支持
