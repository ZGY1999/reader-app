import { describe, it, expect, beforeEach } from 'vitest';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService();
  });

  describe('buildIndex', () => {
    it('应该成功构建索引', async () => {
      const bookId = 'book1';
      const content = '这是一本关于人工智能的书籍。AI技术正在改变世界。';

      await expect(searchService.buildIndex(bookId, content)).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('应该能搜索到匹配的内容', async () => {
      const bookId = 'book1';
      const content = '这是一本关于人工智能的书籍。AI技术正在改变世界。';

      await searchService.buildIndex(bookId, content);
      const results = await searchService.search(bookId, '人工智能');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('position');
    });

    it('搜索不存在的内容应返回空数组', async () => {
      const bookId = 'book1';
      const content = '这是一本关于人工智能的书籍。';

      await searchService.buildIndex(bookId, content);
      const results = await searchService.search(bookId, '量子计算');

      expect(results).toEqual([]);
    });

    it('应该支持模糊搜索', async () => {
      const bookId = 'book1';
      const content = '人工智能技术发展迅速。';

      await searchService.buildIndex(bookId, content);
      const results = await searchService.search(bookId, '人工');

      expect(results.length).toBeGreaterThan(0);
    });
  });
});
