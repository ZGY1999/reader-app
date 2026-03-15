interface AnnotationToolbarProps {
  onAnnotate: (style: string) => void;
  selectionText?: string;
  disabled?: boolean;
}

export default function AnnotationToolbar({ onAnnotate, selectionText, disabled = false }: AnnotationToolbarProps) {
  const feedbackText = selectionText ? `已选中：${selectionText}` : '先选中文本，再选择标注样式';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <p data-testid="annotation-selection-feedback" style={{ margin: 0, color: selectionText ? '#1f1f1f' : '#8c8c8c', fontSize: '14px' }}>
        {feedbackText}
      </p>
      <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('underline')}>直线</button>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('wavy')}>波浪线</button>
        <button type="button" disabled={disabled} onClick={() => onAnnotate('highlight')}>高亮</button>
      </div>
    </div>
  );
}
