# Book Parser

## EPUB 解析器使用示例

```typescript
import { EpubParser } from './epub.parser';

const parser = new EpubParser();
const book = await parser.parse('path/to/book.epub');

console.log(book.title);    // 书籍标题
console.log(book.author);   // 作者
console.log(book.chapters); // 章节列表
```

## 接口定义

```typescript
interface Book {
  id: string;
  title: string;
  author?: string;
  content: string;
  chapters?: Chapter[];
}

interface Chapter {
  id: string;
  title: string;
  content: string;
}
```
