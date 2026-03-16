import { beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const appRoot = path.resolve(__dirname, '..');

describe('electron runtime compatibility', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], {
      cwd: appRoot,
      stdio: 'pipe',
      shell: true,
    });

    execFileSync('npm', ['run', 'build:electron'], {
      cwd: appRoot,
      stdio: 'pipe',
      shell: true,
    });
  });

  it('does not emit a static CommonJS require for the ESM-only PDF.js entry', async () => {
    const compiledParserPath = path.join(appRoot, 'dist', 'services', 'book-parser', 'pdf.parser.js');
    const compiledParser = await fs.readFile(compiledParserPath, 'utf8');
    const compiledDynamicImportPath = path.join(appRoot, 'dist', 'utils', 'dynamic-import.js');
    const compiledDynamicImport = await fs.readFile(compiledDynamicImportPath, 'utf8');

    expect(compiledParser).not.toContain('require("pdfjs-dist/legacy/build/pdf.mjs")');
    expect(compiledDynamicImport).not.toContain('require(s)');
  });

  it('copies the database schema asset into the compiled runtime output', async () => {
    const compiledSchemaPath = path.join(appRoot, 'dist', 'database', 'schema.sql');
    const compiledSchema = await fs.readFile(compiledSchemaPath, 'utf8');

    expect(compiledSchema).toContain('CREATE TABLE');
    expect(compiledSchema).toContain('books');
  });

  it('emits relative renderer asset paths for file:// loading', async () => {
    const builtHtmlPath = path.join(appRoot, 'dist', 'renderer', 'index.html');
    const builtHtml = await fs.readFile(builtHtmlPath, 'utf8');

    expect(builtHtml).not.toContain('src="/assets/');
    expect(builtHtml).not.toContain('href="/assets/');
  });
});
