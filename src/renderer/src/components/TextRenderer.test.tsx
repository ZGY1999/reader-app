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

  it('computes selection offsets against the full rendered content when annotations already split the DOM', () => {
    const annotations: Annotation[] = [
      { id: '1', bookId: 'book-1', startOffset: 0, endOffset: 5, text: 'Alpha', style: 'highlight' },
    ];
    const onAnnotate = vi.fn();

    render(
      <TextRenderer
        content="Alpha Beta Gamma"
        annotations={annotations}
        onAnnotate={onAnnotate}
      />
    );

    const renderer = screen.getByText('Alpha').parentElement as HTMLDivElement;
    const trailingTextNode = renderer.childNodes[1] as Text;
    const fakePrefixRange = {
      selectNodeContents: vi.fn(),
      setEnd: vi.fn(),
      toString: () => 'Alpha ',
    };
    const fakeRange = {
      startContainer: trailingTextNode,
      startOffset: 0,
      endContainer: trailingTextNode,
      endOffset: 4,
      cloneRange: vi.fn(() => fakePrefixRange),
      getBoundingClientRect: () => ({
        top: 10,
        left: 20,
        width: 40,
        height: 12,
        right: 60,
        bottom: 22,
      }),
    };

    vi.spyOn(window, 'getSelection').mockReturnValue({
      isCollapsed: false,
      rangeCount: 1,
      toString: () => 'Beta',
      getRangeAt: () => fakeRange,
    } as unknown as Selection);

    fireEvent.mouseUp(renderer);

    expect(onAnnotate).toHaveBeenCalledWith(expect.objectContaining({
      startOffset: 6,
      endOffset: 10,
      text: 'Beta',
    }));
  });
});
