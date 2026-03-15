import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/src/App';

describe('App', () => {
  it('应该渲染应用', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByText('书架')).toBeDefined();
  });

  it('应该配置路由', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(window.location.pathname).toBe('/');
  });
});
