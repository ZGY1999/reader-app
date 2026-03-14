import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnotationToolbar from './AnnotationToolbar';

describe('AnnotationToolbar', () => {
  it('应该渲染三个标注按钮', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} />);

    expect(screen.getByText('直线')).toBeDefined();
    expect(screen.getByText('波浪线')).toBeDefined();
    expect(screen.getByText('高亮')).toBeDefined();
  });

  it('点击按钮应该调用回调', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} />);

    fireEvent.click(screen.getByText('直线'));
    expect(onAnnotate).toHaveBeenCalledWith('underline');

    fireEvent.click(screen.getByText('波浪线'));
    expect(onAnnotate).toHaveBeenCalledWith('wavy');

    fireEvent.click(screen.getByText('高亮'));
    expect(onAnnotate).toHaveBeenCalledWith('highlight');
  });
});
