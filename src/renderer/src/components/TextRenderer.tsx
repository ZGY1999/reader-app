interface Annotation {
  id: string;
  startOffset: number;
  endOffset: number;
  text: string;
  style: string;
}

interface TextRendererProps {
  content: string;
  annotations?: Annotation[];
  onAnnotate?: (data: { startOffset: number; endOffset: number; text: string }) => void;
}

export default function TextRenderer({ content, annotations = [], onAnnotate }: TextRendererProps) {
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !onAnnotate) return;

    const text = selection.toString();
    const range = selection.getRangeAt(0);
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    onAnnotate({ startOffset, endOffset, text });
  };

  const renderContent = () => {
    if (annotations.length === 0) return content;

    const parts: JSX.Element[] = [];
    let lastIndex = 0;

    annotations.forEach((ann, i) => {
      if (ann.startOffset > lastIndex) {
        parts.push(<span key={`text-${i}`}>{content.slice(lastIndex, ann.startOffset)}</span>);
      }
      parts.push(
        <span key={ann.id} className={`annotation-${ann.style}`}>
          {content.slice(ann.startOffset, ann.endOffset)}
        </span>
      );
      lastIndex = ann.endOffset;
    });

    if (lastIndex < content.length) {
      parts.push(<span key="text-end">{content.slice(lastIndex)}</span>);
    }

    return parts;
  };

  return (
    <div style={{ padding: '20px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }} onMouseUp={handleMouseUp}>
      {renderContent()}
    </div>
  );
}

