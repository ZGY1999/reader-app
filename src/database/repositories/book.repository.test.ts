import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../sqlite';
import { BookRepository } from './book.repository';
import * as fs from 'fs';
import * as path from 'path';

describe('BookRepository', () => {
  let db: Database;
  let repo: BookRepository;
  const testDbPath = path.join(__dirname, 'test.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    repo = new BookRepository(db);
  });

  it('应该能添加书籍', () => {
    const book = {
      id: 'test-1',
      title: '测试书籍',
      author: '测试作者',
      format: 'txt',
      filePath: '/test/path.txt'
    };

    repo.add(book);
    const result = repo.findById('test-1');

    expect(result).toBeDefined();
    expect(result?.title).toBe('测试书籍');
  });

  it('应该能获取所有书籍', () => {
    repo.add({ id: '1', title: '书1', format: 'txt', filePath: '/1.txt' });
    repo.add({ id: '2', title: '书2', format: 'txt', filePath: '/2.txt' });

    const books = repo.findAll();
    expect(books).toHaveLength(2);
  });
});
