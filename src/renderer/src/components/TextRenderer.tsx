import type { CSSProperties, ReactNode } from 'react';
import { useRef } from 'react';
import './annotation.css';
import { Annotation } from '../types';

interface TextRendererProps {
  content: string;
  annotations?: Annotation[];
  offsetBase?: number;
  testId?: string;
  activeAnnotationId?: string;
  highlightRange?: { startOffset: number; endOffset: number } | null;
  style?: CSSProperties;
  onAnnotate?: (data: {
    startOffset: number;
    endOffset: number;
    text: string;
    rect: DOMRect;
    rects?: Array<{
      left: number;
      top: number;
      width: number;
      height: number;
      right: number;
      bottom: number;
    }>;
  }) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  onClearSelection?: () => void;
}

export default function TextRenderer({
  content,
  annotations = [],
  offsetBase = 0,
  testId,
  activeAnnotationId,
  highlightRange,
  style,
  onAnnotate,
  onSelectAnnotation,
  onClearSelection,
}: TextRendererProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      onClearSelection?.();
      return;
    }
    if (!onAnnotate) return;

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

    const text = selection.toString();
    if (!text.trim()) {
      onClearSelection?.();
      return;
    }

    let startOffset = offsetBase + range.startOffset;
    let endOffset = offsetBase + range.endOffset;

    if (range.startContainer && typeof range.cloneRange === 'function') {
      const prefixRange = range.cloneRange();
      prefixRange.selectNodeContents(container);
      prefixRange.setEnd(range.startContainer, range.startOffset);

      startOffset = offsetBase + prefixRange.toString().length;
      endOffset = startOffset + text.length;
    }

    const rect = range.getBoundingClientRect();
    const rects = (typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : []).map((clientRect) => ({
      left: clientRect.left,
      top: clientRect.top,
      width: clientRect.width,
      height: clientRect.height,
      right: clientRect.right,
      bottom: clientRect.bottom,
    }));

    onAnnotate({ startOffset, endOffset, text, rect, rects });
  };

  const renderContent = () => {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let plainIndex = 0;

    const pushPlainSegments = (start: number, end: number, keyPrefix: string) => {
      if (start >= end) return;

      if (!highlightRange || highlightRange.endOffset <= start || highlightRange.startOffset >= end) {
        parts.push(<span key={`${keyPrefix}-${plainIndex++}`}>{content.slice(start, end)}</span>);
        return;
      }

      if (highlightRange.startOffset > start) {
        parts.push(<span key={`${keyPrefix}-${plainIndex++}`}>{content.slice(start, highlightRange.startOffset)}</span>);
      }

      const highlightStart = Math.max(start, highlightRange.startOffset);
      const highlightEnd = Math.min(end, highlightRange.endOffset);
      if (highlightStart < highlightEnd) {
        parts.push(
          <span key={`${keyPrefix}-${plainIndex++}`} className="tts-highlight">
            {content.slice(highlightStart, highlightEnd)}
          </span>
        );
      }

      if (highlightRange.endOffset < end) {
        parts.push(<span key={`${keyPrefix}-${plainIndex++}`}>{content.slice(highlightRange.endOffset, end)}</span>);
      }
    };

    if (annotations.length === 0) {
      pushPlainSegments(0, content.length, 'text');
      return parts;
    }

    annotations.forEach((annotation, index) => {
      pushPlainSegments(lastIndex, annotation.startOffset, `text-${index}`);

      const isHighlighted = !!highlightRange
        && highlightRange.startOffset < annotation.endOffset
        && highlightRange.endOffset > annotation.startOffset;

      parts.push(
        <span
          key={annotation.id}
          role="button"
          tabIndex={0}
          data-testid={`annotation-${annotation.id}`}
          aria-label={`Select annotation ${annotation.text}`}
          className={`annotation-mark annotation-${annotation.style}${activeAnnotationId === annotation.id ? ' annotation-active' : ''}${isHighlighted ? ' tts-highlight' : ''}`}
          onClick={() => onSelectAnnotation?.(annotation)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectAnnotation?.(annotation);
            }
          }}
        >
          {content.slice(annotation.startOffset, annotation.endOffset)}
        </span>
      );
      lastIndex = annotation.endOffset;
    });

    pushPlainSegments(lastIndex, content.length, 'text-end');

    return parts;
  };

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      style={{ padding: '20px', lineHeight: '1.8', whiteSpace: 'pre-wrap', ...style }}
      onMouseUp={handleMouseUp}
    >
      {renderContent()}
    </div>
  );
}
