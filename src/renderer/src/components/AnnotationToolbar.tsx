import type { CSSProperties } from 'react';

interface AnnotationToolbarProps {
  mode: 'selection' | 'annotation';
  onAnnotate: (style: string) => void;
  onCopySelection?: () => void;
  onAskAI?: () => void;
  onSpeakSelection?: () => void;
  onDeleteAnnotation?: () => void;
  onClearActive?: () => void;
  annotationActionsEnabled?: boolean;
  style?: CSSProperties;
}

const TOOLBAR_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 10px',
  background: '#2d2f33',
  color: '#f7f3ee',
  borderRadius: '16px',
  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.2)',
  fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif',
};

const BUTTON_STYLE: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: '12px',
  lineHeight: 1.2,
  padding: '4px 6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  borderRadius: '10px',
};

const EMPHASIS_BUTTON_STYLE: CSSProperties = {
  ...BUTTON_STYLE,
  color: '#f7c76f',
};

export default function AnnotationToolbar({
  mode,
  onAnnotate,
  onCopySelection,
  onAskAI,
  onSpeakSelection,
  onDeleteAnnotation,
  onClearActive,
  annotationActionsEnabled = true,
  style,
}: AnnotationToolbarProps) {
  const disabledButtonStyle: CSSProperties = {
    ...BUTTON_STYLE,
    opacity: 0.45,
    cursor: 'not-allowed',
  };

  return (
    <div data-testid="selection-toolbar" style={{ ...TOOLBAR_STYLE, ...style }}>
      {mode === 'selection' ? (
        <>
          <button data-testid="toolbar-copy" type="button" style={BUTTON_STYLE} onClick={onCopySelection}>复制</button>
          <button data-testid="toolbar-highlight" type="button" disabled={!annotationActionsEnabled} style={annotationActionsEnabled ? BUTTON_STYLE : disabledButtonStyle} onClick={() => onAnnotate('highlight')}>马克笔</button>
          <button data-testid="toolbar-wavy" type="button" disabled={!annotationActionsEnabled} style={annotationActionsEnabled ? BUTTON_STYLE : disabledButtonStyle} onClick={() => onAnnotate('wavy')}>波浪线</button>
          <button data-testid="toolbar-underline" type="button" disabled={!annotationActionsEnabled} style={annotationActionsEnabled ? BUTTON_STYLE : disabledButtonStyle} onClick={() => onAnnotate('underline')}>直线</button>
          <button data-testid="toolbar-speak" type="button" style={EMPHASIS_BUTTON_STYLE} onClick={onSpeakSelection}>朗读</button>
          <button data-testid="toolbar-ai" type="button" style={EMPHASIS_BUTTON_STYLE} onClick={onAskAI}>AI问书</button>
        </>
      ) : (
        <>
          <button data-testid="toolbar-delete-annotation" type="button" style={BUTTON_STYLE} onClick={onDeleteAnnotation}>删除标注</button>
          <button data-testid="toolbar-clear-annotation" type="button" style={BUTTON_STYLE} onClick={onClearActive}>取消选中</button>
        </>
      )}
    </div>
  );
}


