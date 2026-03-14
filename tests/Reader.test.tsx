import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Reader from '../src/renderer/src/pages/Reader';

describe('Reader', () => {
  it('应该渲染阅读器', () => {
    render(
      <BrowserRouter>
        <Reader />
      </BrowserRouter>
    );
    expect(screen.getByText('请选择书籍')).toBeDefined();
  });
});
