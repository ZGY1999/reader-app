export interface HighlightRange {
  startOffset: number;
  endOffset: number;
}

/**
 * 高亮服务 - 负责计算文本高亮范围
 *
 * 职责边界：
 * - ✅ 计算高亮位置和范围（业务逻辑）
 * - ❌ 不操作 DOM（如滚动，应由 React 组件实现）
 * - ❌ 不监听播放状态（应由组件通过 props 传递）
 */
export class HighlightService {
  private readonly HIGHLIGHT_LENGTH = 15; // 每次高亮字符数

  updateProgress(progress: number, totalLength: number): HighlightRange {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const startOffset = Math.floor(clampedProgress * totalLength);
    const endOffset = Math.min(startOffset + this.HIGHLIGHT_LENGTH, totalLength);
    return { startOffset, endOffset };
  }

  reset(): void {
    // 无状态，无需操作
  }
}
