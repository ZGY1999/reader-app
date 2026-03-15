import type { CSSProperties } from 'react';

interface AnnotationToolbarProps {
  mode: 'selection' | 'annotation';
  onAnnotate: (style: string) => void;
  onCopySelection?: () => void;
  onAskAI?: () => void;
  onDeleteAnnotation?: () => void;
  onClearActive?: () => void;
  style?: CSSProperties;
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '14px',
  padding: '10px 14px',
  background: '#2d2f33',
  color: '#f7f3ee',
  borderRadius: '14px',
  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2)',
  fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
};

const BUTTON_STYLE: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: '12px',
  lineHeight: 1.3,
  padding: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const AI_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  color: '#f7c76f',
};

export default function AnnotationToolbar({
  mode,
  onAnnotate,
  onCopySelection,
  onAskAI,
  onDeleteAnnotation,
  onClearActive,
  style,
}: AnnotationToolbarProps) {
  return (
    <div data-testid="selection-toolbar" style={{ ...TOOLBAR_STYLE, ...style }}>
      {mode === 'selection' ? (
        <>
          <button type="button" style={BUTTON_STYLE} onClick={onCopySelection}>复制</button>
          <button type="button" style={BUTTON_STYLE} onClick={() => onAnnotate('highlight')}>马克笔</button>
          <button type="button" style={BUTTON_STYLE} onClick={() => onAnnotate('wavy')}>波浪线</button>
          <button type="button" style={BUTTON_STYLE} onClick={() => onAnnotate('underline')}>直线</button>
          <button type="button" style={AI_BUTTON_STYLE} onClick={onAskAI}>AI问书</button>
        </>
      ) : (
        <>
          <button type="button" style={BUTTON_STYLE} onClick={onDeleteAnnotation}>删除标注</button>
          <button type="button" style={BUTTON_STYLE} onClick={onClearActive}>取消选中</button>
        </>
      )}
    </div>
  );
}
