import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/src/App';

describe('Settings route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/settings');
    (window as any).electron = {
      ipcRenderer: {
        invoke: vi.fn().mockResolvedValue({}),
      },
    };
  });

  it('应该在 /settings 渲染设置页', async () => {
    render(<App />);
    expect(await screen.findByText('设置')).toBeDefined();
  });
});
