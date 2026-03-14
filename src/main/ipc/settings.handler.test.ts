import { Database } from '../../database/sqlite';
import { SettingsHandler } from './settings.handler';
import * as fs from 'fs';
import * as path from 'path';

describe('SettingsHandler', () => {
  let db: Database;
  let handler: SettingsHandler;
  const testDbPath = path.join(__dirname, 'test-settings-handler.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    handler = new SettingsHandler(db);
  });

  test('should save setting', async () => {
    const result = await handler.saveSetting('fontSize', '16');
    expect(result.success).toBe(true);
  });

  test('should get setting', async () => {
    await handler.saveSetting('theme', 'dark');
    const result = await handler.getSetting('theme');
    expect(result).toBe('dark');
  });

  test('should get all settings', async () => {
    await handler.saveSetting('fontSize', '16');
    await handler.saveSetting('theme', 'light');
    const result = await handler.getAllSettings();
    expect(result).toEqual({ fontSize: '16', theme: 'light' });
  });
});
