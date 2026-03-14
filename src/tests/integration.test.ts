import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../database/sqlite';
import { BookHandler } from '../main/ipc/book.handler';
import * as fs from 'fs';
import * as path from 'path';

describe('集成测试：完整阅读流程', () => {
  let handler: BookHandler;
  let db: Database;
  const testDbPath = path.join(__dirname, 'integration-test.db');
  const testBookPath = path.join(__dirname, 'test-book.txt');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testBookPath)) fs.unlinkSync(testBookPath);

    fs.writeFileSync(testBookPath, '测试小说\n作者：测试作者\n第一章 开始\n这是第一章的内容。\n第二章 继续\n这是第二章的内容。');

    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new BookHandler(db);
  });

  it('完整流程：导入书籍 -> 获取列表 -> 保存进度 -> 恢复进度', async () => {
    const importResult = await handler.importBook(testBookPath);
    expect(importResult.success).toBe(true);
    expect(importResult.book?.title).toBe('测试小说');

    const books = await handler.getBooks();
    expect(books.length).toBe(1);
    expect(books[0].title).toBe('测试小说');

    const bookId = books[0].id;
    await handler.saveProgress(bookId, 'ch-1', 500, 0.3);

    const progress = await handler.getProgress(bookId);
    expect(progress?.offset).toBe(500);
    expect(progress?.progress).toBe(0.3);

    fs.unlinkSync(testBookPath);
  });
});
