import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookHandler } from './book.handler';
import { Database } from '../../database/sqlite';
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

  it('应该使用 EPUB 解析器导入 epub 文件', async () => {
    const mockBook = {
      id: 'epub-1',
      title: 'EPUB 测试书',
      author: '作者',
      format: 'epub' as const,
      content: '内容',
      chapters: [],
    };

    (handler as any).txtParser = {
      parse: vi.fn().mockRejectedValue(new Error('wrong parser')),
    };
    (handler as any).epubParser = {
      parse: vi.fn().mockResolvedValue(mockBook),
    };

    const result = await handler.importBook('test.epub');

    expect(result.success).toBe(true);
    expect(result.book?.format).toBe('epub');
    expect((handler as any).epubParser.parse).toHaveBeenCalledWith('test.epub');
  });

  it('应该使用 PDF 解析器导入 pdf 文件', async () => {
    const mockBook = {
      id: 'pdf-1',
      title: 'PDF 测试书',
      author: '作者',
      format: 'pdf' as const,
      content: '内容',
      chapters: [],
    };

    (handler as any).txtParser = {
      parse: vi.fn().mockRejectedValue(new Error('wrong parser')),
    };
    (handler as any).pdfParser = {
      parse: vi.fn().mockResolvedValue(mockBook),
    };

    const result = await handler.importBook('test.pdf');

    expect(result.success).toBe(true);
    expect(result.book?.format).toBe('pdf');
    expect((handler as any).pdfParser.parse).toHaveBeenCalledWith('test.pdf');
  });
});
