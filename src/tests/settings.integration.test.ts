import { Database } from '../database/sqlite';
import { SettingsRepository } from '../database/repositories/settings.repository';
import { SettingsHandler } from '../main/ipc/settings.handler';
import * as fs from 'fs';
import * as path from 'path';

describe('Settings Integration Test', () => {
  let db: Database;
  let handler: SettingsHandler;
  const testDbPath = path.join(__dirname, 'test-integration.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new SettingsHandler(db);
  });

  test('完整流程：保存设置 -> 获取设置 -> 应用主题', async () => {
    // 保存字体设置
    await handler.saveSetting('fontSize', '18');
    await handler.saveSetting('lineHeight', '2.0');
    await handler.saveSetting('theme', 'dark');

    // 获取单个设置
    const fontSize = await handler.getSetting('fontSize');
    expect(fontSize).toBe('18');

    // 获取所有设置
    const all = await handler.getAllSettings();
    expect(all).toEqual({
      fontSize: '18',
      lineHeight: '2.0',
      theme: 'dark'
    });
  });

  test('更新设置应该覆盖旧值', async () => {
    await handler.saveSetting('theme', 'light');
    await handler.saveSetting('theme', 'dark');

    const theme = await handler.getSetting('theme');
    expect(theme).toBe('dark');
  });
});
