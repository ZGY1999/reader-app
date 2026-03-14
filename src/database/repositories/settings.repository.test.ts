import { Database } from '../sqlite';
import { SettingsRepository } from './settings.repository';
import * as fs from 'fs';
import * as path from 'path';

describe('SettingsRepository', () => {
  let db: Database;
  let repo: SettingsRepository;
  const testDbPath = path.join(__dirname, 'test-settings.db');

  beforeEach(async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    db = new Database(testDbPath);
    await db.init();
    db.initialize();
    repo = new SettingsRepository(db);
  });

  test('should save and get setting', () => {
    repo.set('fontSize', '16');
    expect(repo.get('fontSize')).toBe('16');
  });

  test('should return undefined for non-existent key', () => {
    expect(repo.get('nonExistent')).toBeUndefined();
  });

  test('should update existing setting', () => {
    repo.set('theme', 'light');
    repo.set('theme', 'dark');
    expect(repo.get('theme')).toBe('dark');
  });

  test('should get all settings', () => {
    repo.set('fontSize', '16');
    repo.set('theme', 'light');
    const all = repo.getAll();
    expect(all).toEqual({ fontSize: '16', theme: 'light' });
  });
});
