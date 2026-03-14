import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationHandler } from './annotation.handler';
import { Database } from '../../database/sqlite';
import * as fs from 'fs';
import * as path from 'path';

describe('AnnotationHandler', () => {
  let handler: AnnotationHandler;
  let db: Database;
  const testDbPath = path.join(__dirname, 'test-annotation-handler.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new AnnotationHandler(db);
  });

  it('应该能创建标注', async () => {
    const result = await handler.createAnnotation({
      bookId: 'book1',
      startOffset: 0,
      endOffset: 10,
      text: '测试文本',
      style: 'underline'
    });

    expect(result.success).toBe(true);
    expect(result.annotation?.text).toBe('测试文本');
  });

  it('应该能获取书籍的标注列表', async () => {
    await handler.createAnnotation({ bookId: 'book1', startOffset: 0, endOffset: 10, text: '文本1', style: 'underline' });
    await handler.createAnnotation({ bookId: 'book1', startOffset: 20, endOffset: 30, text: '文本2', style: 'highlight' });

    const annotations = await handler.getAnnotations('book1');

    expect(annotations.length).toBe(2);
  });

  it('应该能删除标注', async () => {
    const result = await handler.createAnnotation({ bookId: 'book1', startOffset: 0, endOffset: 10, text: '文本', style: 'underline' });
    const deleteResult = await handler.deleteAnnotation(result.annotation!.id);

    expect(deleteResult.success).toBe(true);
  });
});
