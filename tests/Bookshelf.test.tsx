import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Bookshelf from '../src/renderer/src/pages/Bookshelf';

describe('Bookshelf', () => {
  it('应该渲染书架标题', () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );
    expect(screen.getByText('书架')).toBeDefined();
  });

  it('应该显示空书架提示', () => {
    render(
      <BrowserRouter>
        <Bookshelf />
      </BrowserRouter>
    );
    expect(screen.getByText('暂无书籍')).toBeDefined();
  });
});
