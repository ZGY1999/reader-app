import { beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/database/sqlite';
import { BookHandler } from '../src/main/ipc/book.handler';
import * as fs from 'fs';
import * as path from 'path';

describe('Reading payload flow', () => {
  let handler: BookHandler;
  let db: Database;
  const testDbPath = path.join(__dirname, 'reading-flow.db');
  const testBookPath = path.join(__dirname, 'reading-flow.txt');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testBookPath)) fs.unlinkSync(testBookPath);

    fs.writeFileSync(
      testBookPath,
      '测试小说\n作者：测试作者\n第一章 开始\n这是第一章的内容。\n第二章 继续\n这是第二章的内容。'
    );

    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new BookHandler(db);
  });

  it('应该返回统一的阅读 payload', async () => {
    const importResult = await handler.importBook(testBookPath);
    expect(importResult.success).toBe(true);

    const books = await handler.getBooks();
    const payload = await handler.getBookContent(books[0].id);

    expect(payload).toEqual({
      book: expect.objectContaining({
        id: books[0].id,
        title: '测试小说',
        format: 'txt',
      }),
      content: expect.any(String),
      chapters: expect.any(Array),
    });
  });
});
