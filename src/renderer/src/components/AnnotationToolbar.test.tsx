import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnnotationToolbar from './AnnotationToolbar';

describe('AnnotationToolbar', () => {
  it('renders three annotation buttons and disables them without a selection', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} disabled />);

    expect(screen.getByText('先选中文本，再选择标注样式')).toBeDefined();
    expect((screen.getByRole('button', { name: '直线' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '波浪线' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '高亮' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows the selected text and calls back with the chosen style', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} selectionText="Chapter" />);

    expect(screen.getByTestId('annotation-selection-feedback').textContent).toContain('Chapter');

    fireEvent.click(screen.getByRole('button', { name: '直线' }));
    expect(onAnnotate).toHaveBeenCalledWith('underline');

    fireEvent.click(screen.getByRole('button', { name: '波浪线' }));
    expect(onAnnotate).toHaveBeenCalledWith('wavy');

    fireEvent.click(screen.getByRole('button', { name: '高亮' }));
    expect(onAnnotate).toHaveBeenCalledWith('highlight');
  });
});
