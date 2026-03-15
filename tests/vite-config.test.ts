import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Vite config', () => {
  it('pins the dev server to port 5174 for Electron development', () => {
    const config = fs.readFileSync(path.join(__dirname, '../vite.config.ts'), 'utf8');

    expect(config).toContain('server:');
    expect(config).toContain('port: 5174');
    expect(config).toContain('strictPort: true');
  });
});
