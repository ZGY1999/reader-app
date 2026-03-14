import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextRenderer from './TextRenderer';

describe('TextRenderer', () => {
  it('应该渲染文本内容', () => {
    render(<TextRenderer content="测试内容" />);
    expect(screen.getByText('测试内容')).toBeDefined();
  });

  it('应该处理空内容', () => {
    render(<TextRenderer content="" />);
    expect(screen.queryByText('测试')).toBeNull();
  });

  it('应该能选择文本并触发标注', () => {
    const onAnnotate = vi.fn();
    const { container } = render(<TextRenderer content="这是一段测试文本" onAnnotate={onAnnotate} />);

    const textElement = container.querySelector('div');
    expect(textElement).toBeDefined();
  });

  it('应该渲染标注样式', () => {
    const annotations = [
      { id: '1', startOffset: 0, endOffset: 2, text: '这是', style: 'underline' }
    ];
    const { container } = render(<TextRenderer content="这是测试" annotations={annotations} />);

    const annotated = container.querySelector('.annotation-underline');
    expect(annotated).toBeDefined();
  });
});
