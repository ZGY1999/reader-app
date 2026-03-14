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

  it('应该支持历史对话', async () => {
    // Arrange
    const history = [
      { role: 'user' as const, content: '第一个问题' },
      { role: 'assistant' as const, content: '第一个回答' }
    ];

    vi.mocked(mockVectorService.search).mockResolvedValue([
      { chunkId: '1', content: '书籍内容', score: 0.9 }
    ]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '基于历史的回答' } }]
      })
    });

    // Act
    const result = await chatService.chat({
      bookId: 'book1',
      question: '后续问题',
      history
    });

    // Assert
    expect(result).toBe('基于历史的回答');

    // 验证 history 被正确传递到 API
    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.messages).toContainEqual({ role: 'user', content: '第一个问题' });
    expect(body.messages).toContainEqual({ role: 'assistant', content: '第一个回答' });
    expect(body.messages[body.messages.length - 1]).toEqual({ role: 'user', content: '后续问题' });
  });

  it('应该基于检索内容回答，当内容不相关时提示用户', async () => {
    // Arrange - mock 检索返回空结果
    vi.mocked(mockVectorService.search).mockResolvedValue([]);

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '书籍中没有找到相关内容' } }]
      })
    });

    // Act
    const result = await chatService.chat({
      bookId: 'book1',
      question: '不相关的问题'
    });

    // Assert
    expect(result).toBe('书籍中没有找到相关内容');

    // 验证系统提示词中包含反幻觉规则
    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    const systemMessage = body.messages[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('如果内容中没有相关信息');
    expect(systemMessage.content).toContain('不要编造或推测');
  });
});
