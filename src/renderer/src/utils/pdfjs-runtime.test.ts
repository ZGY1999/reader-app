import { describe, expect, it } from 'vitest';
import { resolvePdfJsAssetUrl } from './pdfjs-runtime';

describe('resolvePdfJsAssetUrl', () => {
  it('converts local file urls into vite fs urls for http-based dev sessions on Windows', () => {
    expect(
      resolvePdfJsAssetUrl(
        'file:///D:/Code/reader-app/.worktrees/feat-v0.1-reading-foundation/node_modules/pdfjs-dist/legacy/build/pdf.mjs',
        'http:',
        'http://127.0.0.1:5174'
      )
    ).toBe(
      'http://127.0.0.1:5174/@fs/D:/Code/reader-app/.worktrees/feat-v0.1-reading-foundation/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
    );
  });

  it('keeps file urls unchanged for packaged file-based sessions', () => {
    expect(
      resolvePdfJsAssetUrl(
        'file:///D:/Code/reader-app/.worktrees/feat-v0.1-reading-foundation/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        'file:',
        'file:///D:/Code/reader-app/.worktrees/feat-v0.1-reading-foundation/dist/renderer/index.html'
      )
    ).toBe(
      'file:///D:/Code/reader-app/.worktrees/feat-v0.1-reading-foundation/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'
    );
  });
});
