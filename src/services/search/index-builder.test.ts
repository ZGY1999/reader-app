import { describe, it, expect, beforeEach } from 'vitest';
import { IndexBuilder } from './index-builder';

describe('IndexBuilder', () => {
  let indexBuilder: IndexBuilder;

  beforeEach(() => {
    indexBuilder = new IndexBuilder();
  });

  it('应该能够分段构建索引', async () => {
    const bookId = 'book1';
    const chunks = [
      '第一章：人工智能简介',
      '第二章：机器学习基础',
      '第三章：深度学习应用'
    ];

    await indexBuilder.buildFromChunks(bookId, chunks);
    const results = await indexBuilder.search(bookId, '机器学习');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunkIndex).toBe(1);
  });

  it('应该返回匹配的分段索引', async () => {
    const bookId = 'book1';
    const chunks = ['内容A', '内容B包含关键词', '内容C'];

    await indexBuilder.buildFromChunks(bookId, chunks);
    const results = await indexBuilder.search(bookId, '关键词');

    expect(results[0].chunkIndex).toBe(1);
    expect(results[0].text).toContain('关键词');
  });
});
