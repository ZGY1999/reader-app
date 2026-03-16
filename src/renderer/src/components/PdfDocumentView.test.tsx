import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loadPdfJsMock,
  renderMock,
  getPageMock,
  getDocumentMock,
  textLayerRenderMock,
} = vi.hoisted(() => ({
  loadPdfJsMock: vi.fn(),
  renderMock: vi.fn(),
  getPageMock: vi.fn(),
  getDocumentMock: vi.fn(),
  textLayerRenderMock: vi.fn(),
}));

vi.mock('../utils/pdfjs-runtime', () => ({
  loadPdfJs: () => loadPdfJsMock(),
}));

const pdfJsModule = {
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
  TextLayer: class MockTextLayer {
    private readonly container: HTMLElement;
    private readonly textContentSource: { items: Array<{ str: string }> } | ReadableStream;

    constructor({ container, textContentSource }: { container: HTMLElement; textContentSource: { items: Array<{ str: string }> } | ReadableStream }) {
      this.container = container;
      this.textContentSource = textContentSource;
    }

    async render() {
      let items: Array<{ str: string }> = [];

      if (this.textContentSource instanceof ReadableStream) {
        const reader = this.textContentSource.getReader();
        const chunks: Array<{ items: Array<{ str: string }> }> = [];

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
        }

        items = chunks.flatMap((chunk) => chunk.items ?? []);
      } else {
        items = this.textContentSource.items;
      }

      const textNode = document.createElement('span');
      textNode.textContent = items.map((item) => item.str).join(' ');
      this.container.appendChild(textNode);
      textLayerRenderMock();
    }
  },
  GlobalWorkerOptions: {
    workerSrc: '',
  },
};

import PdfDocumentView from './PdfDocumentView';

const pages = [
  {
    id: 'pdf-page-1',
    title: 'Page 1',
    pageNumber: 1,
    startOffset: 0,
    content: 'Page one text',
  },
  {
    id: 'pdf-page-2',
    title: 'Page 2',
    pageNumber: 2,
    startOffset: 14,
    content: 'Page two text',
  },
];

describe('PdfDocumentView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    loadPdfJsMock.mockReset();
    renderMock.mockReset();
    getPageMock.mockReset();
    getDocumentMock.mockReset();
    textLayerRenderMock.mockReset();

    getPageMock.mockImplementation(async (pageNumber: number) => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
        scale,
      }),
      streamTextContent: () =>
        new ReadableStream({
          start(controller) {
            controller.enqueue({
              items: [{ str: `Page ${pageNumber} text` }],
              styles: {},
              lang: 'en',
            });
            controller.close();
          },
        }),
      getTextContent: async () => ({
        items: [{ str: `Page ${pageNumber} text` }],
      }),
      render: () => ({
        promise: Promise.resolve(renderMock(pageNumber)),
      }),
    }));

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        getPage: getPageMock,
      }),
    });
    loadPdfJsMock.mockResolvedValue(pdfJsModule);

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      canvas: document.createElement('canvas'),
      clearRect: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  it('renders a continuous page list instead of a single page canvas', async () => {
    render(<PdfDocumentView pages={pages} documentData={new Uint8Array([1, 2, 3])} />);

    expect(await screen.findByTestId('chapter-section-pdf-page-1')).toBeDefined();
    expect(await screen.findByTestId('chapter-section-pdf-page-2')).toBeDefined();

    await waitFor(() => {
      expect(getPageMock).toHaveBeenCalledWith(1);
      expect(getPageMock).toHaveBeenCalledWith(2);
    });
  });

  it('loads pdfjs from the runtime loader before loading the document', async () => {
    render(<PdfDocumentView pages={pages} documentData={new Uint8Array([1, 2, 3])} />);

    await waitFor(() => {
      expect(getDocumentMock).toHaveBeenCalled();
    });

    expect(loadPdfJsMock).toHaveBeenCalled();
  });

  it('prefers provided pdf bytes over file urls when loading the document', async () => {
    const documentData = new Uint8Array([7, 8, 9]);

    render(<PdfDocumentView pages={pages} documentData={documentData} />);

    await waitFor(() => {
      expect(getDocumentMock).toHaveBeenCalled();
    });

    const firstCall = getDocumentMock.mock.calls[0]?.[0] as { data: Uint8Array };
    expect(firstCall.data).toEqual(documentData);
    expect(firstCall.data).not.toBe(documentData);
  });

  it('renders page placeholders while waiting for pdf bytes', async () => {
    render(<PdfDocumentView pages={pages} />);

    expect(await screen.findByTestId('chapter-section-pdf-page-1')).toBeDefined();
    expect(screen.getAllByText('Loading PDF...').length).toBeGreaterThan(0);
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it('renders selectable text through a text layer', async () => {
    render(<PdfDocumentView pages={pages} documentData={new Uint8Array([1, 2, 3])} />);

    await waitFor(() => {
      expect(textLayerRenderMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Page 1 text')).toBeDefined();
  });

  it('loads the pdf document once and reuses it on rerender', async () => {
    const documentData = new Uint8Array([5, 6, 7, 8]);
    const { rerender } = render(<PdfDocumentView pages={pages} documentData={documentData} />);

    await waitFor(() => {
      expect(getDocumentMock).toHaveBeenCalledTimes(1);
    });

    rerender(<PdfDocumentView pages={pages} documentData={documentData} activeAnnotationId="ann-1" />);

    await waitFor(() => {
      expect(getDocumentMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not rerender already loaded pages when selection state changes upstream', async () => {
    const documentData = new Uint8Array([9, 9, 9]);
    const { rerender } = render(<PdfDocumentView pages={pages} documentData={documentData} />);

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(2);
    });

    rerender(<PdfDocumentView pages={pages} documentData={documentData} activeAnnotationId="ann-1" />);

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledTimes(2);
      expect(getPageMock).toHaveBeenCalledTimes(2);
    });
  });

  it('clears native selection after capturing a pdf text selection', async () => {
    const onAnnotate = vi.fn();
    const removeAllRanges = vi.fn();

    render(<PdfDocumentView pages={pages} documentData={new Uint8Array([1, 2, 3])} onAnnotate={onAnnotate} />);

    await screen.findByText('Page 1 text');

    const textNode = screen.getByText('Page 1 text').firstChild as Text;
    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Page',
      removeAllRanges,
      getRangeAt: () => ({
        startContainer: textNode,
        startOffset: 0,
        endContainer: textNode,
        endOffset: 4,
        commonAncestorContainer: textNode,
        cloneRange: () => ({
          selectNodeContents: vi.fn(),
          setEnd: vi.fn(),
          toString: () => '',
        }),
        getBoundingClientRect: () => ({
          top: 100,
          left: 120,
          width: 80,
          height: 24,
          right: 200,
          bottom: 124,
        }),
      }),
    } as unknown as Selection);

    fireEvent.mouseUp(screen.getByText('Page 1 text'));

    expect(onAnnotate).toHaveBeenCalledWith(expect.objectContaining({
      startOffset: 0,
      endOffset: 4,
      text: 'Page',
    }));
    expect(removeAllRanges).toHaveBeenCalled();
  });

  it('selects an existing pdf annotation when the overlay is clicked', async () => {
    const onSelectAnnotation = vi.fn();
    vi.spyOn(document, 'createRange').mockImplementation(() => ({
      setStart: vi.fn(),
      setEnd: vi.fn(),
      getClientRects: () => ([
        {
          left: 40,
          top: 60,
          width: 100,
          height: 22,
          right: 140,
          bottom: 82,
          x: 40,
          y: 60,
          toJSON: () => ({}),
        } as DOMRect,
      ] as unknown as DOMRectList),
    }) as unknown as Range);

    render(
      <PdfDocumentView
        pages={[
          {
            ...pages[0],
            annotations: [
              {
                id: 'ann-1',
                bookId: 'book-1',
                startOffset: 0,
                endOffset: 4,
                text: 'Page',
                style: 'highlight',
              },
            ],
          },
        ]}
        documentData={new Uint8Array([1, 2, 3])}
        onSelectAnnotation={onSelectAnnotation}
      />
    );

    fireEvent.click(await screen.findByTestId('annotation-ann-1'));

    expect(onSelectAnnotation).toHaveBeenCalledWith(expect.objectContaining({
      id: 'ann-1',
      text: 'Page',
    }));
  });
});
