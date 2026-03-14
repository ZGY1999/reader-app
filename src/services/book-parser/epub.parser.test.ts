import { describe, it, expect, vi } from 'vitest';
import { EpubParser } from './epub.parser';

vi.mock('epubjs', () => ({
  default: vi.fn((filePath: string) => ({
    ready: Promise.resolve(),
    loaded: {
      metadata: Promise.resolve({
        title: '测试书籍',
        creator: '测试作者'
      }),
      navigation: Promise.resolve({
        toc: [
          { label: '第一章', href: 'chapter1.xhtml' },
          { label: '第二章', href: 'chapter2.xhtml' }
        ]
      })
    },
    spine: {
      get: vi.fn((href: string) => ({
        load: vi.fn(() => Promise.resolve()),
        document: {
          body: {
            textContent: href === 'chapter1.xhtml' ? '第一章内容' : '第二章内容'
          }
        }
      }))
    },
    load: {
      bind: vi.fn(() => vi.fn())
    }
  }))
}));

describe('EpubParser', () => {
  const parser = new EpubParser();

  it('应该解析 EPUB 文件并提取元数据', async () => {
    const book = await parser.parse('test.epub');

    expect(book).toBeDefined();
    expect(book.id).toBeDefined();
    expect(book.title).toBe('测试书籍');
    expect(book.content).toBeDefined();
  });

  it('应该提取章节列表', async () => {
    const book = await parser.parse('test.epub');

    expect(book.chapters).toBeDefined();
    expect(Array.isArray(book.chapters)).toBe(true);
    expect(book.chapters?.length).toBe(2);
    expect(book.chapters?.[0].title).toBe('第一章');
    expect(book.chapters?.[0].content).toBe('第一章内容');
  });

  it('应该提取作者信息', async () => {
    const book = await parser.parse('test.epub');

    expect(book.author).toBe('测试作者');
  });
});
