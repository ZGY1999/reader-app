import { describe, expect, it, vi } from 'vitest';
import { EpubParser } from '../src/services/book-parser/epub.parser';

const getEntryMock = vi.fn();

vi.mock('adm-zip', () => ({
  default: vi.fn(() => ({
    getEntry: getEntryMock,
  })),
}));

describe('EpubParser contract', () => {
  const parser = new EpubParser();

  it('should return the normalized EPUB parsing shape', async () => {
    getEntryMock.mockImplementation((entryPath: string) => {
      const normalizedPath = entryPath.replace(/\\/g, '/');
      const entries: Record<string, string> = {
        'META-INF/container.xml': `<?xml version="1.0"?>
          <container version="1.0">
            <rootfiles>
              <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
            </rootfiles>
          </container>`,
        'OEBPS/content.opf': `<?xml version="1.0"?>
          <package version="3.0">
            <metadata>
              <title>Test EPUB</title>
              <creator>Test Author</creator>
            </metadata>
            <manifest>
              <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
              <item id="chapter-1" href="chapter1.xhtml" media-type="application/xhtml+xml" />
              <item id="chapter-2" href="chapter2.xhtml" media-type="application/xhtml+xml" />
            </manifest>
            <spine>
              <itemref idref="chapter-1" />
              <itemref idref="chapter-2" />
            </spine>
          </package>`,
        'OEBPS/nav.xhtml': `<?xml version="1.0"?>
          <html>
            <body>
              <nav type="toc">
                <ol>
                  <li><a href="chapter1.xhtml">Chapter 1</a></li>
                  <li><a href="chapter2.xhtml">Chapter 2</a></li>
                </ol>
              </nav>
            </body>
          </html>`,
        'OEBPS/chapter1.xhtml': `<html><body><h1>Chapter 1</h1><p>First chapter body</p></body></html>`,
        'OEBPS/chapter2.xhtml': `<html><body><h1>Chapter 2</h1><p>Second chapter body</p></body></html>`,
      };
      const entry = entries[normalizedPath];

      if (!entry) {
        return null;
      }

      return {
        getData: () => ({
          toString: () => entry,
        }),
      };
    });

    const book = await parser.parse('test.epub');

    expect(book).toMatchObject({
      id: expect.any(String),
      title: 'Test EPUB',
      author: 'Test Author',
      format: 'epub',
      content: expect.any(String),
      chapters: expect.any(Array),
    });
    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0]).toMatchObject({
      title: 'Chapter 1',
      content: 'Chapter 1 First chapter body',
    });
    expect(book.chapters[1]).toMatchObject({
      title: 'Chapter 2',
      content: 'Chapter 2 Second chapter body',
    });
  });
});
