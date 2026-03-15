import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TextRenderer from './TextRenderer';
import { Annotation } from '../types';

describe('TextRenderer', () => {
  it('renders plain content', () => {
    render(<TextRenderer content="Test content" />);
    expect(screen.getByText('Test content')).toBeDefined();
  });

  it('handles empty content', () => {
    render(<TextRenderer content="" />);
    expect(screen.queryByText('Test')).toBeNull();
  });

  it('renders annotation styles', () => {
    const annotations: Annotation[] = [
      { id: '1', startOffset: 0, endOffset: 4, text: 'Test', style: 'underline' },
    ];

    const { container } = render(<TextRenderer content="Test body" annotations={annotations} />);

    expect(container.querySelector('.annotation-underline')).toBeDefined();
  });

  it('selects an annotation instead of deleting it directly', () => {
    const annotations: Annotation[] = [
      { id: '1', startOffset: 0, endOffset: 4, text: 'Test', style: 'underline' },
    ];
    const onSelectAnnotation = vi.fn();

    render(<TextRenderer content="Test body" annotations={annotations} onSelectAnnotation={onSelectAnnotation} />);

    fireEvent.click(screen.getByTestId('annotation-1'));
    expect(onSelectAnnotation).toHaveBeenCalledWith(annotations[0]);
  });

  it('marks the active annotation with a dedicated class', () => {
    const annotations: Annotation[] = [
      { id: '1', startOffset: 0, endOffset: 4, text: 'Test', style: 'highlight' },
    ];

    render(<TextRenderer content="Test body" annotations={annotations} activeAnnotationId="1" />);

    expect(screen.getByTestId('annotation-1').className).toContain('annotation-mark');
    expect(screen.getByTestId('annotation-1').className).toContain('annotation-active');
  });
});
