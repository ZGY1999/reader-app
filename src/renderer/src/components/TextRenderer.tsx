import './annotation.css';
import { Annotation } from '../types';

interface TextRendererProps {
  content: string;
  annotations?: Annotation[];
  offsetBase?: number;
  testId?: string;
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string }) => void;
  onSelectAnnotation?: (annotation: Annotation) => void;
  onClearSelection?: () => void;
}

export default function TextRenderer({
  content,
  annotations = [],
  offsetBase = 0,
  testId,
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
    if (annotations.length === 0) return content;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    annotations.forEach((annotation, index) => {
      if (annotation.startOffset > lastIndex) {
        parts.push(<span key={`text-${index}`}>{content.slice(lastIndex, annotation.startOffset)}</span>);
      }

      parts.push(
        <span
          key={annotation.id}
          role="button"
          tabIndex={0}
          data-testid={`annotation-${annotation.id}`}
          aria-label={`Select annotation ${annotation.text}`}
          className={`annotation-${annotation.style}`}
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

    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{content.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div data-testid={testId} style={{ padding: '20px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }} onMouseUp={handleMouseUp}>
      {renderContent()}
    </div>
  );
}
