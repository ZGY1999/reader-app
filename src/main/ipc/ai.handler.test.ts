import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIHandler } from './ai.handler';

describe('AIHandler', () => {
  const readingPayload = {
    book: {
      id: 'book-1',
      title: 'Test Book',
      format: 'txt' as const,
      filePath: '/test.txt',
    },
    content: 'Chapter one content\n\nChapter two content',
    chapters: [
      { id: 'ch-1', title: 'Chapter 1', content: 'Chapter one content' },
      { id: 'ch-2', title: 'Chapter 2', content: 'Chapter two content' },
    ],
  };

  let settingsHandler: { getAllSettings: ReturnType<typeof vi.fn> };
  let bookHandler: { getBookContent: ReturnType<typeof vi.fn> };
  let vectorService: { addDocument: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> };
  let chatService: { chat: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    settingsHandler = {
      getAllSettings: vi.fn().mockResolvedValue({}),
    };
    bookHandler = {
      getBookContent: vi.fn().mockResolvedValue(readingPayload),
    };
    vectorService = {
      addDocument: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    };
    chatService = {
      chat: vi.fn().mockResolvedValue('Answer'),
    };
  });

  it('returns not configured when the AI API key is missing', async () => {
    const handler = new AIHandler(
      bookHandler as any,
      settingsHandler as any,
      () => vectorService as any,
      () => chatService as any,
    );

    expect(await handler.getStatus()).toEqual({ configured: false });

    await expect(handler.ask({ bookId: 'book-1', question: 'What is chapter one about?' })).resolves.toEqual({
      success: false,
      code: 'NOT_CONFIGURED',
      error: '请先在设置中配置 AI API Key',
    });
  });

  it('indexes the book once and returns answer with citations', async () => {
    settingsHandler.getAllSettings.mockResolvedValue({
      aiApiKey: 'test-key',
      aiBaseUrl: 'https://api.test.com/v1',
    });
    vectorService.search.mockResolvedValue([
      {
        chunkId: 'book-1:chunk-1',
        content: 'Chapter one content',
        score: 0.91,
      },
    ]);

    const handler = new AIHandler(
      bookHandler as any,
      settingsHandler as any,
      () => vectorService as any,
      () => chatService as any,
    );

    const firstResult = await handler.ask({ bookId: 'book-1', question: 'What is chapter one about?' });
    const secondResult = await handler.ask({ bookId: 'book-1', question: 'What is chapter one about?' });

    expect(vectorService.addDocument).toHaveBeenCalledTimes(1);
    expect(bookHandler.getBookContent).toHaveBeenCalledTimes(1);
    expect(chatService.chat).toHaveBeenCalledTimes(2);
    expect(firstResult).toMatchObject({
      success: true,
      answer: 'Answer',
      citations: [
        {
          chunkId: 'book-1:chunk-1',
          chapterId: 'ch-1',
          chapterTitle: 'Chapter 1',
          text: 'Chapter one content',
        },
      ],
    });
    expect(secondResult).toMatchObject({
      success: true,
      citations: [
        {
          chapterTitle: 'Chapter 1',
        },
      ],
    });
  });
});
