interface AnnotationToolbarProps {
  onAnnotate: (style: string) => void;
}

export default function AnnotationToolbar({ onAnnotate }: AnnotationToolbarProps) {
  return (
    <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
      <button onClick={() => onAnnotate('underline')}>直线</button>
      <button onClick={() => onAnnotate('wavy')}>波浪线</button>
      <button onClick={() => onAnnotate('highlight')}>高亮</button>
    </div>
  );
}
