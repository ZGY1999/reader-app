import { describe, it, expect, vi } from 'vitest';
import { EpubParser } from '../src/services/book-parser/epub.parser';

vi.mock('epubjs', () => ({
  default: vi.fn(() => ({
    ready: Promise.resolve(),
    loaded: {
      metadata: Promise.resolve({
        title: '测试 EPUB',
        creator: '测试作者',
      }),
      navigation: Promise.resolve({
        toc: [
          { label: '第一章', href: 'chapter1.xhtml' },
          { label: '第二章', href: 'chapter2.xhtml' },
        ],
      }),
    },
    spine: {
      get: vi.fn((href: string) => ({
        load: vi.fn(() => Promise.resolve()),
        document: {
          body: {
            textContent: href === 'chapter1.xhtml' ? '第一章内容' : '第二章内容',
          },
        },
      })),
    },
    load: {
      bind: vi.fn(() => vi.fn()),
    },
  })),
}));

describe('EpubParser contract', () => {
  const parser = new EpubParser();

  it('应该返回统一的 EPUB 解析结构', async () => {
    const book = await parser.parse('test.epub');

    expect(book).toMatchObject({
      id: expect.any(String),
      title: '测试 EPUB',
      author: '测试作者',
      format: 'epub',
      content: expect.any(String),
      chapters: expect.any(Array),
    });
    expect(book.chapters).toHaveLength(2);
  });
});
