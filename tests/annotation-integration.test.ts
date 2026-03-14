import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../src/database/sqlite';
import { AnnotationHandler } from '../src/main/ipc/annotation.handler';
import * as fs from 'fs';
import * as path from 'path';

describe('标注系统集成测试', () => {
  let db: Database;
  let handler: AnnotationHandler;
  const testDbPath = path.join(__dirname, 'test-annotation-integration.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new AnnotationHandler(db);
  });

  it('完整的标注流程：创建、查询、删除', async () => {
    // 1. 创建标注
    const result1 = await handler.createAnnotation({
      bookId: 'book1',
      startOffset: 0,
      endOffset: 4,
      text: '这是测试',
      style: 'underline'
    });
    expect(result1.success).toBe(true);

    const result2 = await handler.createAnnotation({
      bookId: 'book1',
      startOffset: 10,
      endOffset: 15,
      text: '高亮文本',
      style: 'highlight'
    });
    expect(result2.success).toBe(true);

    // 2. 查询标注
    const annotations = await handler.getAnnotations('book1');
    expect(annotations.length).toBe(2);
    expect(annotations[0].style).toBe('underline');
    expect(annotations[1].style).toBe('highlight');

    // 3. 删除标注
    const deleteResult = await handler.deleteAnnotation(result1.annotation!.id);
    expect(deleteResult.success).toBe(true);

    const remainingAnnotations = await handler.getAnnotations('book1');
    expect(remainingAnnotations.length).toBe(1);
    expect(remainingAnnotations[0].style).toBe('highlight');
  });
});
