import { describe, it, expect, beforeEach } from 'vitest';
import { HighlightService } from './highlight.service';

describe('HighlightService', () => {
  let service: HighlightService;

  beforeEach(() => {
    service = new HighlightService();
  });

  it('应该在进度 0% 时返回起始位置', () => {
    const result = service.updateProgress(0, 1000);
    expect(result.startOffset).toBe(0);
    expect(result.endOffset).toBeGreaterThan(0);
  });

  it('应该在进度 50% 时返回中间位置', () => {
    const result = service.updateProgress(0.5, 1000);
    expect(result.startOffset).toBe(500);
    expect(result.endOffset).toBeGreaterThan(500);
  });

  it('应该在进度 100% 时返回结束位置', () => {
    const result = service.updateProgress(1, 1000);
    expect(result.startOffset).toBeLessThanOrEqual(1000);
    expect(result.endOffset).toBe(1000);
  });

  it('应该在 reset 后返回起始位置', () => {
    service.updateProgress(0.5, 1000);
    service.reset();
    const result = service.updateProgress(0, 1000);
    expect(result.startOffset).toBe(0);
    expect(result.endOffset).toBeGreaterThan(0);
  });

  it('应该返回有长度的高亮范围', () => {
    const result = service.updateProgress(0.3, 1000);
    expect(result.endOffset).toBeGreaterThan(result.startOffset);
    expect(result.endOffset - result.startOffset).toBeGreaterThanOrEqual(10);
  });
});
