import { Database } from '../../database/sqlite';
import { SettingsRepository } from '../../database/repositories/settings.repository';

export class SettingsHandler {
  private repo: SettingsRepository;

  constructor(db: Database) {
    this.repo = new SettingsRepository(db);
  }

  async saveSetting(key: string, value: string) {
    this.repo.set(key, value);
    return { success: true };
  }

  async getSetting(key: string) {
    return this.repo.get(key);
  }

  async getAllSettings() {
    return this.repo.getAll();
  }
}
