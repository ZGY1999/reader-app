import { Database } from '../sqlite';

export class SettingsRepository {
  constructor(private db: Database) {}

  set(key: string, value: string): void {
    this.db.query(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
    this.db.save();
  }

  get(key: string): string | undefined {
    const results = this.db.query('SELECT value FROM app_settings WHERE key = ?', [key]);
    return results.length > 0 ? results[0].value : undefined;
  }

  getAll(): Record<string, string> {
    const results = this.db.query('SELECT key, value FROM app_settings');
    return results.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }
}
