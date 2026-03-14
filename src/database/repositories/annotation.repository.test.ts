import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../sqlite';
import { AnnotationRepository } from './annotation.repository';
import * as fs from 'fs';
import * as path from 'path';

describe('AnnotationRepository', () => {
  let db: Database;
  let repo: AnnotationRepository;
  const testDbPath = path.join(__dirname, 'test-annotation.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    repo = new AnnotationRepository(db);
  });

  it('应该能添加标注', () => {
    const annotation = {
      id: 'ann1',
      bookId: 'book1',
      startOffset: 0,
      endOffset: 10,
      text: '测试文本',
      style: 'underline'
    };

    repo.add(annotation);
    const result = repo.findById('ann1');

    expect(result).toBeDefined();
    expect(result?.text).toBe('测试文本');
    expect(result?.style).toBe('underline');
  });

  it('应该能获取书籍的所有标注', () => {
    repo.add({ id: 'ann1', bookId: 'book1', startOffset: 0, endOffset: 10, text: '文本1', style: 'underline' });
    repo.add({ id: 'ann2', bookId: 'book1', startOffset: 20, endOffset: 30, text: '文本2', style: 'highlight' });

    const annotations = repo.findByBookId('book1');

    expect(annotations.length).toBe(2);
    expect(annotations[0].id).toBe('ann1');
  });

  it('应该能删除标注', () => {
    repo.add({ id: 'ann1', bookId: 'book1', startOffset: 0, endOffset: 10, text: '文本', style: 'underline' });
    repo.delete('ann1');

    const result = repo.findById('ann1');
    expect(result).toBeUndefined();
  });
});
