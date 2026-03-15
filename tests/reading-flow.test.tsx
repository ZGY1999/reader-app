import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
      ['Test Novel', 'Author: Test Author', 'Chapter 1', 'First chapter content.', 'Chapter 2', 'Second chapter content.'].join('\n')
    );

    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new BookHandler(db);
  });

  afterEach(() => {
    db?.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    if (fs.existsSync(testBookPath)) fs.unlinkSync(testBookPath);
  });

  it('returns a unified reading payload', async () => {
    const importResult = await handler.importBook(testBookPath);
    expect(importResult.success).toBe(true);

    const books = await handler.getBooks();
    const payload = await handler.getBookContent(books[0].id);

    expect(payload).toEqual({
      book: expect.objectContaining({
        id: books[0].id,
        title: 'Test Novel',
        format: 'txt',
      }),
      content: expect.any(String),
      chapters: expect.any(Array),
    });
  });
});
