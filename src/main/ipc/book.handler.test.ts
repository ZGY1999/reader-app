import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookHandler } from './book.handler';
import { Database } from '../../database/sqlite';
import { BookRepository } from '../../database/repositories/book.repository';
import { TxtParser } from '../../services/book-parser/txt.parser';
import * as fs from 'fs';
import * as path from 'path';

describe('BookHandler', () => {
  let handler: BookHandler;
  let db: Database;
  const testDbPath = path.join(__dirname, 'test-handler.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new BookHandler(db);
  });

  it('应该能导入书籍', async () => {
    const testFile = path.join(__dirname, 'test.txt');
    fs.writeFileSync(testFile, '测试书籍\n作者：测试\n第一章\n内容');

    const result = await handler.importBook(testFile);

    expect(result.success).toBe(true);
    expect(result.book?.title).toBe('测试书籍');

    fs.unlinkSync(testFile);
  });

  it('应该能获取书籍列表', async () => {
    const books = await handler.getBooks();
    expect(Array.isArray(books)).toBe(true);
  });
});
