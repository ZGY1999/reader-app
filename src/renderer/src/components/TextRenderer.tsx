import type { ReactNode } from 'react';
import './annotation.css';
import { Annotation } from '../types';

interface TextRendererProps {
  content: string;
  annotations?: Annotation[];
  offsetBase?: number;
  testId?: string;
  activeAnnotationId?: string;
  highlightRange?: { startOffset: number; endOffset: number } | null;
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string }) => void;
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
  onAnnotate,
  onSelectAnnotation,
  onClearSelection,
}: TextRendererProps) {
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onClearSelection?.();
      return;
    }
    if (!onAnnotate) return;

    const text = selection.toString();
    const range = selection.getRangeAt(0);
    const startOffset = offsetBase + range.startOffset;
    const endOffset = offsetBase + range.endOffset;

    onAnnotate({ startOffset, endOffset, text });
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
    <div data-testid={testId} style={{ padding: '20px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }} onMouseUp={handleMouseUp}>
      {renderContent()}
    </div>
  );
}
