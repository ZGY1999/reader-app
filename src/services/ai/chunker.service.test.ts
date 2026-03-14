import { describe, it, expect } from 'vitest';
import { ChunkerService, TextChunk } from './chunker.service';
import { Chapter } from '../book-parser/txt.parser';

describe('ChunkerService', () => {
  const chunker = new ChunkerService();
  const bookId = 'test-book-id';

  describe('按章节分块', () => {
    it('应该将每个章节作为一个块', () => {
      const chapters: Chapter[] = [
        {
          id: 'ch1',
          title: '第一章',
          content: '这是第一章的内容'
        },
        {
          id: 'ch2',
          title: '第二章',
          content: '这是第二章的内容'
        }
      ];

      const chunks = chunker.chunkByChapter(chapters, bookId);

      expect(chunks).toHaveLength(2);
      expect(chunks[0].chapterId).toBe('ch1');
      expect(chunks[0].content).toBe('这是第一章的内容');
      expect(chunks[1].chapterId).toBe('ch2');
      expect(chunks[1].content).toBe('这是第二章的内容');
    });

    it('应该设置正确的 startOffset 和 endOffset', () => {
      const chapters: Chapter[] = [
        {
          id: 'ch1',
          title: '第一章',
          content: '内容1'
        }
      ];

      const chunks = chunker.chunkByChapter(chapters, bookId);

      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBe(3);
    });

    it('应该为每个块生成唯一的 id', () => {
      const chapters: Chapter[] = [
        {
          id: 'ch1',
          title: '第一章',
          content: '内容'
        },
        {
          id: 'ch2',
          title: '第二章',
          content: '内容'
        }
      ];

      const chunks = chunker.chunkByChapter(chapters, bookId);

      expect(chunks[0].id).not.toBe(chunks[1].id);
    });
  });

  describe('按段落分块', () => {
    it('应该将长文本按固定大小分块', () => {
      const text = '这是一个很长的文本。'.repeat(50); // 约 300 字
      const chunks = chunker.chunkByParagraph(text, bookId, 'ch1', 100);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(100);
      });
    });

    it('应该实现 50 字重叠', () => {
      const text = '这是一个很长的文本。'.repeat(50);
      const chunks = chunker.chunkByParagraph(text, bookId, 'ch1', 100, 50);

      if (chunks.length > 1) {
        const firstChunkEnd = chunks[0].endOffset;
        const secondChunkStart = chunks[1].startOffset;
        expect(firstChunkEnd - secondChunkStart).toBe(50);
      }
    });

    it('应该正确计算中文字符', () => {
      const text = '中文测试';
      const chunks = chunker.chunkByParagraph(text, bookId, 'ch1', 10);

      expect(chunks[0].content).toBe('中文测试');
      expect(chunks[0].endOffset).toBe(4);
    });
  });

  describe('空内容处理', () => {
    it('应该处理空章节列表', () => {
      const chunks = chunker.chunkByChapter([], bookId);
      expect(chunks).toHaveLength(0);
    });

    it('应该处理空文本', () => {
      const chunks = chunker.chunkByParagraph('', bookId, 'ch1', 100);
      expect(chunks).toHaveLength(0);
    });

    it('应该处理空内容的章节', () => {
      const chapters: Chapter[] = [
        {
          id: 'ch1',
          title: '第一章',
          content: ''
        }
      ];

      const chunks = chunker.chunkByChapter(chapters, bookId);
      expect(chunks).toHaveLength(0);
    });
  });
});
