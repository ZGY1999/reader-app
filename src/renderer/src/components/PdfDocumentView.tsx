import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Annotation } from '../types';
import { loadPdfJs } from '../utils/pdfjs-runtime';
import './pdf-view.css';

interface PdfPageViewModel {
  id: string;
  title: string;
  pageNumber: number;
  startOffset: number;
  content: string;
  annotations?: Annotation[];
  pendingSelectionRange?: { startOffset: number; endOffset: number } | null;
  highlightRange?: { startOffset: number; endOffset: number } | null;
}

interface PdfDocumentViewProps {
  filePath?: string;
  documentData?: Uint8Array;
  pages: PdfPageViewModel[];
  scrollContainer?: HTMLDivElement | null;
  activeAnnotationId?: string;
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string; rect: DOMRect }) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  onClearSelection?: () => void;
  onSectionRef?: (pageId: string, element: HTMLElement | null) => void;
}

type LoadedPdfDocument = {
  getPage: (pageNumber: number) => Promise<any>;
  destroy?: () => Promise<void> | void;
};

type PdfJsModule = Awaited<ReturnType<typeof loadPdfJs>>;

type PageDimensions = {
  width: number;
  height: number;
};

interface OffsetMap {
  normalizedText: string;
  rawToNormalized: number[];
  normalizedToRaw: number[];
  rawLength: number;
}

interface DomPosition {
  node: Text;
  offset: number;
}

interface TextLayerModel {
  normalizedText: string;
  positions: DomPosition[];
}

interface OverlayRect {
  key: string;
  left: number;
  top: number;
  width: number;
  height: number;
  className: string;
  annotation: Annotation | null;
}

const expandOverlayRect = (
  rect: DOMRect | { left: number; top: number; width: number; height: number },
  viewportRect: DOMRect,
  horizontalPadding: number,
  verticalPadding: number
) => {
  const left = Math.max(rect.left - viewportRect.left - horizontalPadding, 0);
  const top = Math.max(rect.top - viewportRect.top - verticalPadding, 0);
  const right = Math.min(rect.left - viewportRect.left + rect.width + horizontalPadding, viewportRect.width);
  const bottom = Math.min(rect.top - viewportRect.top + rect.height + verticalPadding, viewportRect.height);

  return {
    left,
    top,
    width: Math.max(right - left, 0),
    height: Math.max(bottom - top, 0),
  };
};

const DEFAULT_PAGE_HEIGHT = 1120;
const VIEWPORT_OVERSCAN = 1800;

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim();

const buildOffsetMap = (rawText: string): OffsetMap => {
  const rawToNormalized = new Array(rawText.length + 1).fill(0);
  const normalizedToRaw = [0];
  let normalizedText = '';
  let pendingWhitespace = false;
  let seenContent = false;

  for (let index = 0; index < rawText.length; index += 1) {
    rawToNormalized[index] = normalizedText.length;
    const character = rawText[index];

    if (/\s/.test(character)) {
      if (seenContent) {
        pendingWhitespace = true;
      }
      continue;
    }

    if (pendingWhitespace && normalizedText.length > 0) {
      normalizedText += ' ';
      normalizedToRaw.push(index);
      pendingWhitespace = false;
    }

    normalizedText += character;
    normalizedToRaw.push(index + 1);
    seenContent = true;
  }

  rawToNormalized[rawText.length] = normalizedText.length;

  return {
    normalizedText,
    rawToNormalized,
    normalizedToRaw,
    rawLength: rawText.length,
  };
};

const normalizedOffsetToRaw = (offsetMap: OffsetMap, normalizedOffset: number) => {
  const boundedOffset = Math.max(0, Math.min(normalizedOffset, offsetMap.normalizedText.length));
  return offsetMap.normalizedToRaw[boundedOffset] ?? offsetMap.rawLength;
};

const buildTextLayerModel = (container: HTMLElement): TextLayerModel | null => {
  const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const positions: DomPosition[] = [];
  let normalizedText = '';
  let pendingWhitespacePosition: DomPosition | null = null;
  let firstNode: Text | null = null;
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const textValue = textNode.textContent ?? '';

    if (!firstNode) {
      firstNode = textNode;
      positions[0] = { node: textNode, offset: 0 };
    }

    for (let index = 0; index < textValue.length; index += 1) {
      const character = textValue[index];

      if (/\s/.test(character)) {
        if (normalizedText.length > 0 && !pendingWhitespacePosition) {
          pendingWhitespacePosition = { node: textNode, offset: index };
        }
        continue;
      }

      if (pendingWhitespacePosition && normalizedText.length > 0) {
        normalizedText += ' ';
        positions[normalizedText.length] = pendingWhitespacePosition;
        pendingWhitespacePosition = null;
      }

      normalizedText += character;
      positions[normalizedText.length] = { node: textNode, offset: index + 1 };
    }

    currentNode = walker.nextNode();
  }

  if (!firstNode) {
    return null;
  }

  positions[0] ||= { node: firstNode, offset: 0 };

  return {
    normalizedText,
    positions,
  };
};

const createRangeFromNormalizedOffsets = (
  documentRef: Document,
  textLayerModel: TextLayerModel,
  startOffset: number,
  endOffset: number
) => {
  const maxOffset = textLayerModel.normalizedText.length;
  const boundedStart = Math.max(0, Math.min(startOffset, maxOffset));
  const boundedEnd = Math.max(boundedStart, Math.min(endOffset, maxOffset));
  const startPosition = textLayerModel.positions[boundedStart] ?? textLayerModel.positions[textLayerModel.positions.length - 1];
  const endPosition = textLayerModel.positions[boundedEnd] ?? textLayerModel.positions[textLayerModel.positions.length - 1];

  if (!startPosition || !endPosition) {
    return null;
  }

  const range = documentRef.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  return range;
};

const getNormalizedOffsetFromDomPosition = (
  textLayerModel: TextLayerModel,
  targetNode: Node,
  targetOffset: number
) => {
  const resolvedNode = targetNode.nodeType === Node.TEXT_NODE ? targetNode as Text : targetNode.firstChild as Text | null;
  if (!resolvedNode) {
    return null;
  }

  for (let index = 0; index < textLayerModel.positions.length; index += 1) {
    const position = textLayerModel.positions[index];
    if (!position || position.node !== resolvedNode) {
      continue;
    }

    if (position.offset >= targetOffset) {
      return index;
    }
  }

  for (let index = textLayerModel.positions.length - 1; index >= 0; index -= 1) {
    const position = textLayerModel.positions[index];
    if (position?.node === resolvedNode) {
      return index;
    }
  }

  return null;
};

const buildOverlayRects = (
  viewportContainer: HTMLElement,
  textLayer: HTMLElement,
  page: PdfPageViewModel,
  activeAnnotationId?: string
): OverlayRect[] => {
  const textLayerModel = buildTextLayerModel(textLayer);
  if (!textLayerModel) {
    return [];
  }

  const offsetMap = buildOffsetMap(page.content);
  const viewportRect = viewportContainer.getBoundingClientRect();
  const overlays: OverlayRect[] = [];

  (page.annotations ?? []).forEach((annotation) => {
    const normalizedStart = offsetMap.rawToNormalized[Math.max(annotation.startOffset, 0)] ?? 0;
    const normalizedEnd = offsetMap.rawToNormalized[Math.max(annotation.endOffset, 0)] ?? textLayerModel.normalizedText.length;
    const range = createRangeFromNormalizedOffsets(textLayer.ownerDocument, textLayerModel, normalizedStart, normalizedEnd);

    if (!range) {
      return;
    }

    Array.from(range.getClientRects()).forEach((rect, rectIndex) => {
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const expandedRect = expandOverlayRect(rect, viewportRect, annotation.style === 'highlight' ? 2 : 1, 1.5);

      overlays.push({
        key: `${annotation.id}-${rectIndex}`,
        left: expandedRect.left,
        top: expandedRect.top,
        width: expandedRect.width,
        height: expandedRect.height,
        className: `pdf-annotation-overlay annotation-${annotation.style}${activeAnnotationId === annotation.id ? ' annotation-active' : ''}`,
        annotation,
      });
    });
  });

  if (page.pendingSelectionRange) {
    const normalizedStart = offsetMap.rawToNormalized[Math.max(page.pendingSelectionRange.startOffset, 0)] ?? 0;
    const normalizedEnd = offsetMap.rawToNormalized[Math.max(page.pendingSelectionRange.endOffset, 0)] ?? textLayerModel.normalizedText.length;
    const range = createRangeFromNormalizedOffsets(textLayer.ownerDocument, textLayerModel, normalizedStart, normalizedEnd);

    if (range) {
      Array.from(range.getClientRects()).forEach((rect, rectIndex) => {
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const expandedRect = expandOverlayRect(rect, viewportRect, 2, 1.5);

        overlays.push({
          key: `selection-${page.id}-${rectIndex}`,
          left: expandedRect.left,
          top: expandedRect.top,
          width: expandedRect.width,
          height: expandedRect.height,
          className: 'pdf-annotation-overlay pdf-selection-overlay',
          annotation: null,
        });
      });
    }
  }

  if (page.highlightRange) {
    const normalizedStart = offsetMap.rawToNormalized[Math.max(page.highlightRange.startOffset, 0)] ?? 0;
    const normalizedEnd = offsetMap.rawToNormalized[Math.max(page.highlightRange.endOffset, 0)] ?? textLayerModel.normalizedText.length;
    const range = createRangeFromNormalizedOffsets(textLayer.ownerDocument, textLayerModel, normalizedStart, normalizedEnd);

    if (range) {
      Array.from(range.getClientRects()).forEach((rect, rectIndex) => {
        if (rect.width <= 0 || rect.height <= 0) {
          return;
        }

        const expandedRect = expandOverlayRect(rect, viewportRect, 2, 1.5);

        overlays.push({
          key: `tts-${page.id}-${rectIndex}`,
          left: expandedRect.left,
          top: expandedRect.top,
          width: expandedRect.width,
          height: expandedRect.height,
          className: 'pdf-annotation-overlay pdf-tts-overlay',
          annotation: null,
        });
      });
    }
  }

  return overlays;
};

interface PdfPageSectionProps {
  pdfDocument: LoadedPdfDocument | null;
  pdfJsModule: PdfJsModule | null;
  page: PdfPageViewModel;
  visible: boolean;
  activeAnnotationId?: string;
  estimatedHeight: number;
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string; rect: DOMRect }) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  onClearSelection?: () => void;
  onSectionRef?: (pageId: string, element: HTMLElement | null) => void;
  onMeasure: (pageNumber: number, dimensions: PageDimensions) => void;
  getCachedPage: (pageNumber: number) => Promise<any>;
}

function PdfPageSection({
  pdfDocument,
  pdfJsModule,
  page,
  visible,
  activeAnnotationId,
  estimatedHeight,
  onAnnotate,
  onSelectAnnotation,
  onClearSelection,
  onSectionRef,
  onMeasure,
  getCachedPage,
}: PdfPageSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const textLayerModelRef = useRef<TextLayerModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  const [overlayRects, setOverlayRects] = useState<OverlayRect[]>([]);
  const offsetMap = useMemo(() => buildOffsetMap(page.content), [page.content]);
  const overlayVersion = useMemo(
    () =>
      JSON.stringify({
        annotations: (page.annotations ?? []).map((annotation) => ({
          id: annotation.id,
          startOffset: annotation.startOffset,
          endOffset: annotation.endOffset,
          style: annotation.style,
        })),
        pendingSelectionRange: page.pendingSelectionRange ?? null,
        highlightRange: page.highlightRange ?? null,
        activeAnnotationId: activeAnnotationId ?? null,
      }),
    [activeAnnotationId, page.annotations, page.highlightRange, page.pendingSelectionRange]
  );
  const shouldDisplayPageContent = visible || hasRenderedOnce;

  useEffect(() => {
    onSectionRef?.(page.id, sectionRef.current);

    return () => {
      onSectionRef?.(page.id, null);
    };
  }, [onSectionRef, page.id]);

  useEffect(() => {
    if (!visible || !pdfDocument || !pdfJsModule) {
      setLoading(!pdfDocument && !hasRenderedOnce);
      return;
    }

    let cancelled = false;
    let renderTask: { cancel?: () => void; promise: Promise<void> } | null = null;
    let textLayerTask: { cancel?: () => void; render: () => Promise<void> } | null = null;

    const renderPage = async () => {
      setError('');
      if (!hasRenderedOnce) {
        setLoading(true);
      }

      try {
        const pdfPage = await getCachedPage(page.pageNumber);
        if (cancelled) {
          return;
        }

        const shell = shellRef.current;
        const viewportContainer = viewportRef.current;
        const canvas = canvasRef.current;
        const textLayer = textLayerRef.current;
        if (!shell || !viewportContainer || !canvas || !textLayer) {
          return;
        }

        const rawViewport = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max((shell.clientWidth || rawViewport.width) - 32, 280);
        const cssScale = Math.max(0.5, availableWidth / rawViewport.width);
        const viewport = pdfPage.getViewport({ scale: cssScale });
        const outputScale = window.devicePixelRatio || 1;
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('PDF canvas context unavailable');
        }

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        viewportContainer.style.width = `${viewport.width}px`;
        viewportContainer.style.height = `${viewport.height}px`;
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        textLayer.innerHTML = '';

        onMeasure(page.pageNumber, {
          width: viewport.width,
          height: viewport.height,
        });

        context.clearRect(0, 0, canvas.width, canvas.height);
        const nextRenderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        } as any);
        renderTask = nextRenderTask;
        await nextRenderTask.promise;

        if (cancelled) {
          return;
        }

        const textContentSource = typeof pdfPage.streamTextContent === 'function'
          ? pdfPage.streamTextContent()
          : await pdfPage.getTextContent();

        if (cancelled) {
          return;
        }

        textLayerTask = new pdfJsModule.TextLayer({
          textContentSource,
          container: textLayer,
          viewport,
        } as any);
        await textLayerTask.render();

        if (cancelled) {
          return;
        }

        textLayerModelRef.current = buildTextLayerModel(textLayer);
        setOverlayRects(buildOverlayRects(viewportContainer, textLayer, page, activeAnnotationId));
        setHasRenderedOnce(true);
        setLoading(false);
      } catch (renderError) {
        if (!cancelled) {
          setError(renderError instanceof Error ? renderError.message : 'Failed to render PDF page');
          setLoading(false);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      textLayerTask?.cancel?.();
    };
  }, [
    getCachedPage,
    onMeasure,
    page.pageNumber,
    pdfDocument,
    pdfJsModule,
    visible,
  ]);

  useEffect(() => {
    if (!hasRenderedOnce) {
      return;
    }

    const viewportContainer = viewportRef.current;
    const textLayer = textLayerRef.current;
    if (!viewportContainer || !textLayer) {
      return;
    }

    textLayerModelRef.current = buildTextLayerModel(textLayer);
    setOverlayRects(buildOverlayRects(viewportContainer, textLayer, page, activeAnnotationId));
  }, [hasRenderedOnce, overlayVersion, page.content]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    const textLayer = textLayerRef.current;

    if (!selection || selection.rangeCount === 0 || !textLayer) {
      return;
    }
    if (!onAnnotate) {
      return;
    }

    if (selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer ?? range.startContainer;
    const ancestorNode = commonAncestor.nodeType === Node.TEXT_NODE ? commonAncestor.parentNode : commonAncestor;

    if (!ancestorNode || !textLayer.contains(ancestorNode)) {
      onClearSelection?.();
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
      return;
    }

    const textLayerModel = textLayerModelRef.current ?? buildTextLayerModel(textLayer);
    if (!textLayerModel) {
      return;
    }

    const normalizedStart = getNormalizedOffsetFromDomPosition(textLayerModel, range.startContainer, range.startOffset);
    const normalizedEnd = getNormalizedOffsetFromDomPosition(textLayerModel, range.endContainer, range.endOffset);

    if (normalizedStart === null || normalizedEnd === null) {
      return;
    }

    const boundedStart = Math.max(0, Math.min(normalizedStart, normalizedEnd));
    const boundedEnd = Math.max(boundedStart, Math.max(normalizedStart, normalizedEnd));
    const normalizedSelection = normalizeText(selectedText);
    const startOffset = page.startOffset + normalizedOffsetToRaw(offsetMap, boundedStart);
    const endOffset = page.startOffset + normalizedOffsetToRaw(offsetMap, boundedEnd);

    onAnnotate({
      startOffset,
      endOffset,
      text: normalizedSelection,
      rect: range.getBoundingClientRect(),
    });
    selection.removeAllRanges?.();
  };

  return (
    <section
      ref={sectionRef}
      data-testid={`chapter-section-${page.id}`}
      className="pdf-page-section"
      aria-label={page.title}
    >
      <div
        ref={shellRef}
        className="pdf-page-shell"
        onMouseUp={handleMouseUp}
        style={{
          minHeight: `${estimatedHeight}px`,
        }}
      >
        {shouldDisplayPageContent && !error ? (
          <div ref={viewportRef} className="pdf-page-viewport">
            <canvas
              ref={canvasRef}
              className="pdf-page-canvas"
              aria-label={`PDF page ${page.pageNumber}`}
            />
            <div className="pdf-annotation-layer">
              {overlayRects.map((rect) => (
                <div
                  key={rect.key}
                  className={rect.className}
                  data-testid={rect.annotation ? `annotation-${rect.annotation.id}` : undefined}
                  onClick={rect.annotation ? () => {
                    if (rect.annotation) {
                      onSelectAnnotation?.(rect.annotation);
                    }
                  } : undefined}
                  style={{
                    left: `${rect.left}px`,
                    top: `${rect.top}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                  }}
                />
              ))}
            </div>
            <div
              ref={textLayerRef}
              className="textLayer pdf-text-layer"
            />
          </div>
        ) : null}
        {!shouldDisplayPageContent ? (
          <div
            className="pdf-page-placeholder"
            style={{ height: `${Math.max(estimatedHeight, 240)}px` }}
          >
            第 {page.pageNumber} 页
          </div>
        ) : null}
        {visible && loading && !error && !hasRenderedOnce ? (
          <div
            className="pdf-page-placeholder"
            style={{ height: `${Math.max(estimatedHeight, 240)}px`, position: 'absolute', inset: '0' }}
          >
            Loading PDF...
          </div>
        ) : null}
        {error ? (
          <div role="alert" style={{ color: '#cf1322', padding: '24px' }}>{error}</div>
        ) : null}
      </div>
    </section>
  );
}

export default function PdfDocumentView({
  documentData,
  pages,
  scrollContainer,
  activeAnnotationId,
  onAnnotate,
  onSelectAnnotation,
  onClearSelection,
  onSectionRef,
}: PdfDocumentViewProps) {
  const [pdfDocument, setPdfDocument] = useState<LoadedPdfDocument | null>(null);
  const [pdfJsModule, setPdfJsModule] = useState<PdfJsModule | null>(null);
  const [visibleRange, setVisibleRange] = useState(() => ({
    start: 0,
    end: Math.min(pages.length - 1, 3),
  }));
  const pageProxyCacheRef = useRef(new Map<number, Promise<any>>());
  const pageDimensionsRef = useRef(new Map<number, PageDimensions>());
  const pageElementsRef = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!documentData || documentData.length === 0) {
      setPdfDocument(null);
      setPdfJsModule(null);
      return;
    }

    let cancelled = false;

    const loadDocument = async () => {
      try {
        const nextModule = await loadPdfJs();
        const loadingTask = nextModule.getDocument({
          data: documentData.slice(0),
        } as any);
        const loadedDocument = await loadingTask.promise;

        if (cancelled) {
          await loadedDocument.destroy?.();
          return;
        }

        pageProxyCacheRef.current.clear();
        setPdfJsModule(nextModule);
        setPdfDocument((currentDocument) => {
          void currentDocument?.destroy?.();
          return loadedDocument;
        });
      } catch {
        if (!cancelled) {
          setPdfDocument(null);
          setPdfJsModule(null);
        }
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
    };
  }, [documentData]);

  useEffect(() => {
    return () => {
      void pdfDocument?.destroy?.();
    };
  }, [pdfDocument]);

  const getCachedPage = useCallback(async (pageNumber: number) => {
    const cachedPage = pageProxyCacheRef.current.get(pageNumber);
    if (cachedPage) {
      return cachedPage;
    }

    if (!pdfDocument) {
      throw new Error('PDF document not loaded');
    }

    const nextPromise = pdfDocument.getPage(pageNumber);
    pageProxyCacheRef.current.set(pageNumber, nextPromise);
    return nextPromise;
  }, [pdfDocument]);

  useEffect(() => {
    const host = scrollContainer;

    if (!host || pages.length === 0) {
      setVisibleRange({
        start: 0,
        end: Math.min(pages.length - 1, 3),
      });
      return;
    }

    const updateVisibleRange = () => {
      const viewportTop = Math.max(host.scrollTop - VIEWPORT_OVERSCAN, 0);
      const viewportBottom = host.scrollTop + host.clientHeight + VIEWPORT_OVERSCAN;

      let firstVisibleIndex = 0;
      let lastVisibleIndex = pages.length - 1;

      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index];
        const element = pageElementsRef.current.get(page.id);
        if (!element) {
          continue;
        }

        const top = element.offsetTop;
        const cachedHeight = pageDimensionsRef.current.get(page.pageNumber)?.height;
        const height = cachedHeight ? cachedHeight + 32 : element.offsetHeight || DEFAULT_PAGE_HEIGHT;
        const bottom = top + height;

        if (bottom >= viewportTop) {
          firstVisibleIndex = Math.max(index - 2, 0);
          break;
        }
      }

      for (let index = firstVisibleIndex; index < pages.length; index += 1) {
        const page = pages[index];
        const element = pageElementsRef.current.get(page.id);
        if (!element) {
          continue;
        }

        const top = element.offsetTop;
        const cachedHeight = pageDimensionsRef.current.get(page.pageNumber)?.height;
        const height = cachedHeight ? cachedHeight + 32 : element.offsetHeight || DEFAULT_PAGE_HEIGHT;

        if (top > viewportBottom) {
          lastVisibleIndex = Math.min(index + 2, pages.length - 1);
          break;
        }

        lastVisibleIndex = index;
      }

      setVisibleRange((current) => {
        if (current.start === firstVisibleIndex && current.end === lastVisibleIndex) {
          return current;
        }

        return {
          start: firstVisibleIndex,
          end: lastVisibleIndex,
        };
      });
    };

    updateVisibleRange();
    host.addEventListener('scroll', updateVisibleRange);
    window.addEventListener('resize', updateVisibleRange);

    return () => {
      host.removeEventListener('scroll', updateVisibleRange);
      window.removeEventListener('resize', updateVisibleRange);
    };
  }, [pages, scrollContainer]);

  const handleMeasure = useCallback((pageNumber: number, dimensions: PageDimensions) => {
    pageDimensionsRef.current.set(pageNumber, dimensions);
  }, []);

  return (
    <div data-testid="pdf-document-view">
      {pages.map((page, index) => {
        const dimensions = pageDimensionsRef.current.get(page.pageNumber);
        const estimatedHeight = dimensions?.height ? dimensions.height + 32 : DEFAULT_PAGE_HEIGHT;
        const isVisible = index >= visibleRange.start && index <= visibleRange.end;

        return (
          <PdfPageSection
            key={page.id}
            pdfDocument={pdfDocument}
            pdfJsModule={pdfJsModule}
            page={page}
            visible={isVisible}
            activeAnnotationId={activeAnnotationId}
            estimatedHeight={estimatedHeight}
            onAnnotate={onAnnotate}
            onSelectAnnotation={onSelectAnnotation}
            onClearSelection={onClearSelection}
            onSectionRef={(pageId, element) => {
              if (element) {
                pageElementsRef.current.set(pageId, element);
              } else {
                pageElementsRef.current.delete(pageId);
              }

              onSectionRef?.(pageId, element);
            }}
            onMeasure={handleMeasure}
            getCachedPage={getCachedPage}
          />
        );
      })}
    </div>
  );
}
