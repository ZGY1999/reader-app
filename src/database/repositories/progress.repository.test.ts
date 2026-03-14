import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../sqlite';
import { ProgressRepository } from './progress.repository';
import * as fs from 'fs';
import * as path from 'path';

describe('ProgressRepository', () => {
  let db: Database;
  let repo: ProgressRepository;
  const testDbPath = path.join(__dirname, 'test-progress.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    repo = new ProgressRepository(db);
  });

  it('应该能保存阅读进度', () => {
    repo.save({ bookId: 'book-1', chapterId: 'ch-1', offset: 100, progress: 0.5 });
    const result = repo.get('book-1');

    expect(result?.offset).toBe(100);
    expect(result?.progress).toBe(0.5);
  });

  it('应该能更新阅读进度', () => {
    repo.save({ bookId: 'book-1', chapterId: 'ch-1', offset: 100, progress: 0.5 });
    repo.save({ bookId: 'book-1', chapterId: 'ch-2', offset: 200, progress: 0.8 });

    const result = repo.get('book-1');
    expect(result?.offset).toBe(200);
  });
});
