import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from './chat.service';
import { VectorService } from './vector.service';

describe('ChatService', () => {
  let chatService: ChatService;
  let mockVectorService: VectorService;
  let mockFetch: any;

  beforeEach(() => {
    mockVectorService = {
      search: vi.fn()
    } as any;

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    chatService = new ChatService('test-key', 'https://api.test.com', mockVectorService);
  });

  it('应该基于检索内容回答问题', async () => {
    // Arrange
    vi.mocked(mockVectorService.search).mockResolvedValue([
      { chunkId: '1', content: '这是书籍内容', score: 0.9 }
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '基于内容的回答' } }]
      })
    });

    // Act
    const result = await chatService.chat({
      bookId: 'book1',
      question: '问题是什么？'
    });

    // Assert
    expect(result).toBe('基于内容的回答');
    expect(mockVectorService.search).toHaveBeenCalledWith('问题是什么？', 3);
  });

  it('应该支持流式响应', async () => {
    // Arrange
    vi.mocked(mockVectorService.search).mockResolvedValue([
      { chunkId: '1', content: '内容', score: 0.9 }
    ]);

    const chunks = ['data: {"choices":[{"delta":{"content":"你"}}]}\n\n', 'data: {"choices":[{"delta":{"content":"好"}}]}\n\n', 'data: [DONE]\n\n'];
    let index = 0;

    mockFetch.mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = new TextEncoder().encode(chunks[index++]);
            return { done: false, value };
          }
        })
      }
    });

    // Act
    const stream = chatService.chatStream({ bookId: 'book1', question: '你好' });
    const results = [];
    for await (const chunk of stream) {
      results.push(chunk);
    }

    // Assert
    expect(results).toEqual(['你', '好']);
  });

  it('应该处理 API 错误', async () => {
    // Arrange
    vi.mocked(mockVectorService.search).mockResolvedValue([]);
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    // Act & Assert
    await expect(chatService.chat({ bookId: 'book1', question: '测试' })).rejects.toThrow('API 错误: 500');
  });
});
