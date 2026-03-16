import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RichContentRenderer from './RichContentRenderer';
import { Annotation } from '../types';

describe('RichContentRenderer', () => {
  it('renders saved annotations back into rich markup and lets the user select them', () => {
    const annotations: Annotation[] = [
      {
        id: 'ann-1',
        bookId: 'book-1',
        startOffset: 0,
        endOffset: 4,
        text: '第一章',
        style: 'highlight',
      },
    ];
    const onSelectAnnotation = vi.fn();

    render(
      <RichContentRenderer
        markup="<section><p>第一章内容</p><p>第二段</p></section>"
        annotations={annotations}
        onSelectAnnotation={onSelectAnnotation}
      />
    );

    const annotation = screen.getByTestId('annotation-ann-1');
    expect(annotation.className).toContain('annotation-highlight');

    fireEvent.click(annotation);

    expect(onSelectAnnotation).toHaveBeenCalledWith(annotations[0]);
  });
});
