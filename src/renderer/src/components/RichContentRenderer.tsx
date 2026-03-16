import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useMemo, useRef } from 'react';
import './annotation.css';
import './rich-content.css';
import { Annotation } from '../types';

interface RichContentRendererProps {
  markup: string;
  annotations?: Annotation[];
  testId?: string;
  style?: CSSProperties;
  offsetBase?: number;
  activeAnnotationId?: string;
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string; rect: DOMRect }) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  onClearSelection?: () => void;
}

const renderAnnotatedMarkup = (
  markup: string,
  annotations: Annotation[],
  activeAnnotationId?: string,
) => {
  if (annotations.length === 0) {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  const orderedAnnotations = [...annotations].sort((left, right) => left.startOffset - right.startOffset);

  let currentNode = walker.nextNode();
  let textOffset = 0;

  while (currentNode) {
    const textNode = currentNode as Text;
    const nextNode = walker.nextNode();
    const textValue = textNode.textContent ?? '';
    const nodeStart = textOffset;
    const nodeEnd = nodeStart + textValue.length;

    if (textValue.length > 0) {
      const overlappingAnnotations = orderedAnnotations.filter(
        (annotation) => annotation.endOffset > nodeStart && annotation.startOffset < nodeEnd,
      );

      if (overlappingAnnotations.length > 0 && textNode.parentNode) {
        const fragment = document.createDocumentFragment();
        let cursor = 0;

        overlappingAnnotations.forEach((annotation) => {
          const segmentStart = Math.max(annotation.startOffset, nodeStart) - nodeStart;
          const segmentEnd = Math.min(annotation.endOffset, nodeEnd) - nodeStart;

          if (segmentEnd <= cursor) {
            return;
          }

          if (segmentStart > cursor) {
            fragment.appendChild(document.createTextNode(textValue.slice(cursor, segmentStart)));
          }

          const annotationNode = document.createElement('span');
          annotationNode.dataset.annotationId = annotation.id;
          annotationNode.setAttribute('data-testid', `annotation-${annotation.id}`);
          annotationNode.setAttribute('role', 'button');
          annotationNode.setAttribute('tabindex', '0');
          annotationNode.setAttribute('aria-label', `Select annotation ${annotation.text}`);
          annotationNode.className = `annotation-mark annotation-${annotation.style}${activeAnnotationId === annotation.id ? ' annotation-active' : ''}`;
          annotationNode.textContent = textValue.slice(segmentStart, segmentEnd);
          fragment.appendChild(annotationNode);
          cursor = segmentEnd;
        });

        if (cursor < textValue.length) {
          fragment.appendChild(document.createTextNode(textValue.slice(cursor)));
        }

        textNode.parentNode.replaceChild(fragment, textNode);
      }
    }

    textOffset = nodeEnd;
    currentNode = nextNode;
  }

  return template.innerHTML;
};

export default function RichContentRenderer({
  markup,
  annotations = [],
  testId,
  style,
  offsetBase = 0,
  activeAnnotationId,
  onAnnotate,
  onSelectAnnotation,
  onClearSelection,
}: RichContentRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const annotationMap = useMemo(() => new Map(annotations.map((annotation) => [annotation.id, annotation])), [annotations]);
  const annotatedMarkup = useMemo(
    () => renderAnnotatedMarkup(markup, annotations, activeAnnotationId),
    [activeAnnotationId, annotations, markup],
  );

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onClearSelection?.();
      return;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container) {
      onClearSelection?.();
      return;
    }

    const commonAncestor = range.commonAncestorContainer ?? range.startContainer;
    if (commonAncestor) {
      const ancestorNode = commonAncestor.nodeType === Node.TEXT_NODE
        ? commonAncestor.parentNode
        : commonAncestor;

      if (!ancestorNode || !container.contains(ancestorNode)) {
        onClearSelection?.();
        return;
      }
    }

    const text = selection.toString().trim();
    if (!text) {
      onClearSelection?.();
      return;
    }

    const prefixRange = range.cloneRange();
    prefixRange.selectNodeContents(container);
    prefixRange.setEnd(range.startContainer, range.startOffset);

    const startOffset = offsetBase + prefixRange.toString().length;
    const endOffset = startOffset + text.length;

    onAnnotate?.({
      startOffset,
      endOffset,
      text,
      rect: range.getBoundingClientRect(),
    });
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const annotationElement = (event.target as HTMLElement).closest<HTMLElement>('[data-annotation-id]');
    if (!annotationElement) {
      return;
    }

    const annotationId = annotationElement.dataset.annotationId;
    if (!annotationId) {
      return;
    }

    const annotation = annotationMap.get(annotationId);
    if (annotation) {
      onSelectAnnotation?.(annotation);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    const annotationElement = (event.target as HTMLElement).closest<HTMLElement>('[data-annotation-id]');
    if (!annotationElement) {
      return;
    }

    const annotationId = annotationElement.dataset.annotationId;
    if (!annotationId) {
      return;
    }

    const annotation = annotationMap.get(annotationId);
    if (annotation) {
      event.preventDefault();
      onSelectAnnotation?.(annotation);
    }
  };

  return (
    <div
      ref={containerRef}
      className="rich-content-renderer"
      data-testid={testId}
      style={{
        padding: '20px',
        lineHeight: '1.9',
        ...style,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseUp={handleMouseUp}
      dangerouslySetInnerHTML={{ __html: annotatedMarkup }}
    />
  );
}
