import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnnotationToolbar from './AnnotationToolbar';

describe('AnnotationToolbar', () => {
  it('renders selection actions and calls the corresponding callbacks', () => {
    const onAnnotate = vi.fn();
    const onCopySelection = vi.fn();
    const onAskAI = vi.fn();

    render(
      <AnnotationToolbar
        mode="selection"
        onAnnotate={onAnnotate}
        onCopySelection={onCopySelection}
        onAskAI={onAskAI}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '复制' }));
    fireEvent.click(screen.getByRole('button', { name: '马克笔' }));
    fireEvent.click(screen.getByRole('button', { name: '波浪线' }));
    fireEvent.click(screen.getByRole('button', { name: '直线' }));
    fireEvent.click(screen.getByRole('button', { name: 'AI问书' }));

    expect(onCopySelection).toHaveBeenCalledTimes(1);
    expect(onAnnotate).toHaveBeenNthCalledWith(1, 'highlight');
    expect(onAnnotate).toHaveBeenNthCalledWith(2, 'wavy');
    expect(onAnnotate).toHaveBeenNthCalledWith(3, 'underline');
    expect(onAskAI).toHaveBeenCalledTimes(1);
  });

  it('renders annotation management actions in annotation mode', () => {
    const onAnnotate = vi.fn();
    const onDeleteAnnotation = vi.fn();
    const onClearActive = vi.fn();

    render(
      <AnnotationToolbar
        mode="annotation"
        onAnnotate={onAnnotate}
        onDeleteAnnotation={onDeleteAnnotation}
        onClearActive={onClearActive}
      />
    );

    expect(screen.queryByRole('button', { name: '复制' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '删除标注' }));
    fireEvent.click(screen.getByRole('button', { name: '取消选中' }));

    expect(onDeleteAnnotation).toHaveBeenCalledTimes(1);
    expect(onClearActive).toHaveBeenCalledTimes(1);
  });
});
