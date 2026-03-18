import * as fs from 'fs';
import * as path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../database/sqlite';
import { AIChatHandler } from './ai-chat.handler';

describe('AIChatHandler', () => {
  let db: Database;
  let handler: AIChatHandler;
  const testDbPath = path.join(__dirname, 'test-ai-chat-handler.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new AIChatHandler(db);
  });

  it('creates threads and lists them ordered by update time', async () => {
    const first = await handler.createThread({
      bookId: 'book-1',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
      title: 'Chapter 1 · Valuation multiples',
    });

    await new Promise((resolve) => setTimeout(resolve, 2));

    const second = await handler.createThread({
      bookId: 'book-1',
      chapterId: 'ch-2',
      chapterTitle: 'Chapter 2',
      title: 'Chapter 2 · Cost of capital',
    });

    expect(first.id).not.toBe(second.id);

    const threads = await handler.listThreads('book-1');
    expect(threads).toHaveLength(2);
    expect(threads[0].chapterId).toBe('ch-2');
    expect(threads[1].chapterId).toBe('ch-1');
  });

  it('appends messages and loads them in created order', async () => {
    const thread = await handler.createThread({
      bookId: 'book-1',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
      title: 'Chapter 1 · Valuation multiples',
    });

    await handler.appendMessage({
      threadId: thread.id,
      bookId: 'book-1',
      role: 'user',
      text: 'Why does this section emphasize valuation multiples?',
      sourceType: 'selection',
      sourceText: 'Valuation multiples...',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
    });

    await handler.appendMessage({
      threadId: thread.id,
      bookId: 'book-1',
      role: 'assistant',
      text: 'Because market sentiment changes how investors price the company.',
      sourceType: 'selection',
      sourceText: 'Valuation multiples...',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
      citations: [{
        chunkId: 'chunk-1',
        chapterId: 'ch-1',
        chapterTitle: 'Chapter 1',
        text: 'Valuation multiples...',
        startOffset: 10,
        endOffset: 30,
        score: 0.91,
      }],
    });

    const messages = await handler.listMessages(thread.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].citationsJson).toContain('chunk-1');
  });

  it('touches the thread when a message is appended', async () => {
    const first = await handler.createThread({
      bookId: 'book-1',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
      title: 'Chapter 1 · Valuation multiples',
    });

    await new Promise((resolve) => setTimeout(resolve, 2));

    const second = await handler.createThread({
      bookId: 'book-1',
      chapterId: 'ch-2',
      chapterTitle: 'Chapter 2',
      title: 'Chapter 2 · Cost of capital',
    });

    await handler.appendMessage({
      threadId: first.id,
      bookId: 'book-1',
      role: 'user',
      text: 'Follow-up question',
      sourceType: 'chapter',
      sourceText: 'chapter context',
      chapterId: 'ch-1',
      chapterTitle: 'Chapter 1',
    });

    const threads = await handler.listThreads('book-1');
    expect(threads[0].id).toBe(first.id);
    expect(threads[1].id).toBe(second.id);
  });
});
