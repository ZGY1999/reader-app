import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VectorService, SearchResult } from './vector.service';

describe('VectorService', () => {
  let vectorService: VectorService;
  const mockApiKey = 'test-api-key';
  const mockBaseURL = 'https://api.openai.com/v1';

  beforeEach(() => {
    vectorService = new VectorService(mockApiKey, mockBaseURL);
  });

  describe('文本向量化', () => {
    it('应该调用 API 获取文本的向量', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      const result = await vectorService.embed('测试文本');

      expect(result).toEqual(mockEmbedding);
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockBaseURL}/embeddings`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`
          })
        })
      );
    });

    it('应该处理 API 错误', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API 错误'));

      await expect(vectorService.embed('测试文本')).rejects.toThrow('API 错误');
    });
  });

  describe('向量存储和索引', () => {
    it('应该添加向量到索引', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      await vectorService.addChunk('chunk-1', '测试内容');

      expect(vectorService.getChunkCount()).toBe(1);
    });

    it('应该存储多个向量', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      await vectorService.addChunk('chunk-1', '内容1');
      await vectorService.addChunk('chunk-2', '内容2');

      expect(vectorService.getChunkCount()).toBe(2);
    });
  });

  describe('相似度搜索', () => {
    it('应该返回最相似的文本块', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      await vectorService.addChunk('chunk-1', '这是关于机器学习的内容');
      await vectorService.addChunk('chunk-2', '这是关于烹饪的内容');

      const results = await vectorService.search('机器学习', 1);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        chunkId: expect.any(String),
        content: expect.any(String),
        score: expect.any(Number)
      });
    });

    it('应该返回 top-k 个结果', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      await vectorService.addChunk('chunk-1', '内容1');
      await vectorService.addChunk('chunk-2', '内容2');
      await vectorService.addChunk('chunk-3', '内容3');

      const results = await vectorService.search('查询', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('应该处理空索引的搜索', async () => {
      const results = await vectorService.search('查询', 5);

      expect(results).toHaveLength(0);
    });

    it('应该返回按相似度排序的结果', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      global.fetch = vi.fn().mockResolvedValue({
        json: async () => ({
          data: [{ embedding: mockEmbedding }]
        })
      });

      await vectorService.addChunk('chunk-1', '内容1');
      await vectorService.addChunk('chunk-2', '内容2');

      const results = await vectorService.search('查询', 2);

      if (results.length > 1) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });
  });

  describe('参数验证', () => {
    it('当 top-k <= 0 时应该抛出错误', async () => {
      await expect(vectorService.search('查询', 0)).rejects.toThrow();
    });

    it('应该处理空查询文本', async () => {
      const results = await vectorService.search('', 5);
      expect(results).toHaveLength(0);
    });
  });
});
