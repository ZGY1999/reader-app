import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../src/database/sqlite';
import * as fs from 'fs';
import * as path from 'path';

describe('Database', () => {
  const testDbPath = path.join(__dirname, 'test.db');
  let db: Database;

  beforeEach(async () => {
    // 清理测试数据库
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('应该成功创建数据库连接', async () => {
    db = new Database(testDbPath);
    await db.init();
    expect(db).toBeDefined();
  });

  it('应该成功初始化数据库表', async () => {
    db = new Database(testDbPath);
    await db.init();
    db.initialize();

    // 验证表是否创建
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map((t: any) => t.name);

    expect(tableNames).toContain('books');
    expect(tableNames).toContain('reading_progress');
  });
});
