interface AnnotationToolbarProps {
  onAnnotate: (style: string) => void;
  selectionText?: string;
  selectedAnnotationText?: string;
  disabled?: boolean;
  onDeleteAnnotation?: () => void;
  onClearActive?: () => void;
}

const COPY = {
  defaultFeedback: '\u5148\u9009\u4e2d\u6587\u672c\uff0c\u518d\u9009\u62e9\u6807\u6ce8\u6837\u5f0f',
  selectionFeedbackPrefix: '\u5df2\u9009\u4e2d\uff1a',
  annotationFeedbackPrefix: '\u5df2\u9009\u4e2d\u6807\u6ce8\uff1a',
  underline: '\u76f4\u7ebf',
  wavy: '\u6ce2\u6d6a\u7ebf',
  highlight: '\u9ad8\u4eae',
  delete: '\u5220\u9664\u6807\u6ce8',
  clear: '\u53d6\u6d88\u9009\u4e2d',
} as const;

export default function AnnotationToolbar({
  onAnnotate,
  selectionText,
  selectedAnnotationText,
  disabled = false,
  onDeleteAnnotation,
  onClearActive,
}: AnnotationToolbarProps) {
  const feedbackText = selectedAnnotationText
    ? `${COPY.annotationFeedbackPrefix}${selectedAnnotationText}`
    : selectionText
      ? `${COPY.selectionFeedbackPrefix}${selectionText}`
      : COPY.defaultFeedback;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p
        data-testid="annotation-selection-feedback"
        style={{ margin: 0, color: selectionText || selectedAnnotationText ? '#1f1f1f' : '#8c8c8c', fontSize: '14px' }}
      >
        {feedbackText}
      </p>
      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', flexWrap: 'wrap' }}>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('underline')}>{COPY.underline}</button>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('wavy')}>{COPY.wavy}</button>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('highlight')}>{COPY.highlight}</button>
        {selectedAnnotationText ? (
          <>
            <button type="button" onClick={onDeleteAnnotation}>{COPY.delete}</button>
            <button type="button" onClick={onClearActive}>{COPY.clear}</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
