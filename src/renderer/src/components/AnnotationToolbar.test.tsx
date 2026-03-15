import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import AnnotationToolbar from './AnnotationToolbar';

describe('AnnotationToolbar', () => {
  it('renders disabled annotation buttons without an active selection', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} disabled />);

    expect(screen.getByText('\u5148\u9009\u4e2d\u6587\u672c\uff0c\u518d\u9009\u62e9\u6807\u6ce8\u6837\u5f0f')).toBeDefined();
    expect((screen.getByRole('button', { name: '\u76f4\u7ebf' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '\u6ce2\u6d6a\u7ebf' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '\u9ad8\u4eae' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '\u5220\u9664\u6807\u6ce8' })).toBeNull();
  });

  it('shows the selected text and calls back with the chosen style', () => {
    const onAnnotate = vi.fn();
    render(<AnnotationToolbar onAnnotate={onAnnotate} selectionText="Chapter" />);

    expect(screen.getByTestId('annotation-selection-feedback').textContent).toContain('Chapter');

    fireEvent.click(screen.getByRole('button', { name: '\u76f4\u7ebf' }));
    expect(onAnnotate).toHaveBeenCalledWith('underline');

    fireEvent.click(screen.getByRole('button', { name: '\u6ce2\u6d6a\u7ebf' }));
    expect(onAnnotate).toHaveBeenCalledWith('wavy');

    fireEvent.click(screen.getByRole('button', { name: '\u9ad8\u4eae' }));
    expect(onAnnotate).toHaveBeenCalledWith('highlight');
  });

  it('shows explicit delete actions when an annotation is selected', () => {
    const onAnnotate = vi.fn();
    const onDeleteAnnotation = vi.fn();
    const onClearActive = vi.fn();

    render(
      <AnnotationToolbar
        onAnnotate={onAnnotate}
        selectedAnnotationText="Marked text"
        disabled
        onDeleteAnnotation={onDeleteAnnotation}
        onClearActive={onClearActive}
      />
    );

    expect(screen.getByTestId('annotation-selection-feedback').textContent).toContain('Marked text');
    expect((screen.getByRole('button', { name: '\u76f4\u7ebf' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '\u5220\u9664\u6807\u6ce8' }));
    expect(onDeleteAnnotation).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '\u53d6\u6d88\u9009\u4e2d' }));
    expect(onClearActive).toHaveBeenCalledTimes(1);
  });
});
