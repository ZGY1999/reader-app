// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { EpubParser } from './epub.parser';

describe('EpubParser', () => {
  const parser = new EpubParser();
  let tempDir: string;
  let sampleFile: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-app-epub-parser-'));
    sampleFile = path.join(tempDir, 'sample.epub');

    const zip = new AdmZip();
    zip.addFile('mimetype', Buffer.from('application/epub+zip'));
    zip.addFile(
      'META-INF/container.xml',
      Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`)
    );
    zip.addFile(
      'OEBPS/content.opf',
      Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>测试 EPUB</dc:title>
    <dc:creator>测试作者</dc:creator>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter-1" href="chapter-1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter-2" href="chapter-2.xhtml" media-type="application/xhtml+xml"/>
    <item id="cover-image" href="images/cover.png" media-type="image/png"/>
  </manifest>
  <spine>
    <itemref idref="chapter-1"/>
    <itemref idref="chapter-2"/>
  </spine>
</package>`)
    );
    zip.addFile(
      'OEBPS/nav.xhtml',
      Buffer.from(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="chapter-1.xhtml">第一章</a></li>
        <li><a href="chapter-2.xhtml">第二章</a></li>
      </ol>
    </nav>
  </body>
</html>`)
    );
    zip.addFile(
      'OEBPS/chapter-1.xhtml',
      Buffer.from('<html><body><h1>第一章</h1><p>第一章内容</p><img alt="配图" data-src="https://example.com/cover.png" src="images/cover.png" /><table><tr><td>表格内容</td></tr></table></body></html>')
    );
    zip.addFile(
      'OEBPS/chapter-2.xhtml',
      Buffer.from('<html><body><h1>第二章</h1><p>第二章内容</p></body></html>')
    );
    zip.addFile('OEBPS/images/cover.png', Buffer.from('fake-image'));

    zip.writeZip(sampleFile);
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('parses EPUB metadata without requiring a browser window', async () => {
    const book = await parser.parse(sampleFile);

    expect(book.title).toBe('测试 EPUB');
    expect(book.author).toBe('测试作者');
    expect(book.format).toBe('epub');
  });

  it('extracts chapters and combined content from an EPUB archive', async () => {
    const book = await parser.parse(sampleFile);

    expect(book.chapters).toHaveLength(2);
    expect(book.chapters[0].title).toBe('第一章');
    expect(book.chapters[0].content).toContain('第一章内容');
    expect(book.chapters[1].title).toBe('第二章');
    expect(book.content).toContain('第一章内容');
    expect(book.content).toContain('第二章内容');
  });

  it('preserves chapter markup and inlines local images for rich rendering', async () => {
    const book = await parser.parse(sampleFile);

    expect(book.chapters[0].markup).toContain('<img');
    expect(book.chapters[0].markup).toContain('data:image/png;base64,');
    expect(book.chapters[0].markup).not.toContain('src="images/cover.png"');
    expect(book.chapters[0].markup).toContain('<table>');
  });
});
