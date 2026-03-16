import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('imports a txt book', async () => {
    const testFile = path.join(__dirname, 'test.txt');
    fs.writeFileSync(testFile, '测试书籍\n作者：测试作者\n第一章\n内容');

    const result = await handler.importBook(testFile);

    expect(result.success).toBe(true);
    expect(result.book?.title).toBe('测试书籍');

    fs.unlinkSync(testFile);
  });

  it('returns the bookshelf list', async () => {
    const books = await handler.getBooks();
    expect(Array.isArray(books)).toBe(true);
  });

  it('imports an epub file through the epub parser', async () => {
    const mockBook = {
      id: 'epub-1',
      title: 'EPUB 测试书',
      author: '作者',
      format: 'epub' as const,
      content: '内容',
      chapters: [],
    };

    (handler as any).epubParser = {
      parse: vi.fn().mockResolvedValue(mockBook),
    };

    const result = await handler.importBook('test.epub');

    expect(result.success).toBe(true);
    expect(result.book?.format).toBe('epub');
    expect((handler as any).epubParser.parse).toHaveBeenCalledWith('test.epub');
  });

  it('imports a pdf file through the pdf parser', async () => {
    const mockBook = {
      id: 'pdf-1',
      title: 'PDF 测试书',
      author: '作者',
      format: 'pdf' as const,
      content: '内容',
      chapters: [],
    };

    (handler as any).pdfParser = {
      parse: vi.fn().mockResolvedValue(mockBook),
    };

    const result = await handler.importBook('test.pdf');

    expect(result.success).toBe(true);
    expect(result.book?.format).toBe('pdf');
    expect((handler as any).pdfParser.parse).toHaveBeenCalledWith('test.pdf');
  });

  it('returns raw pdf bytes with the reading payload for renderer-side pdf rendering', async () => {
    const pdfPath = path.join(__dirname, 'reader.pdf');
    const mockBook = {
      id: 'pdf-1',
      title: 'PDF Reader Test',
      author: 'Author',
      format: 'pdf' as const,
      content: 'Page 1',
      chapters: [
        {
          id: 'pdf-page-1',
          title: 'Page 1',
          content: 'Page 1',
        },
      ],
    };
    const pdfBytes = Buffer.from([1, 2, 3, 4]);

    (handler as any).pdfParser = {
      parse: vi.fn().mockResolvedValue(mockBook),
    };
    fs.writeFileSync(pdfPath, pdfBytes);

    await handler.importBook(pdfPath);
    const payload = await handler.getBookContent('pdf-1');

    expect(payload.pdfData).toEqual(new Uint8Array(pdfBytes));
    fs.unlinkSync(pdfPath);
  });

  it('removes a book by id', async () => {
    const testFile = path.join(__dirname, 'delete-test.txt');
    fs.writeFileSync(testFile, '测试书籍\n内容');

    const importResult = await handler.importBook(testFile);
    const deleteResult = await handler.deleteBook(importResult.book!.id);
    const books = await handler.getBooks();

    expect(deleteResult.success).toBe(true);
    expect(books).toHaveLength(0);

    fs.unlinkSync(testFile);
  });
});
