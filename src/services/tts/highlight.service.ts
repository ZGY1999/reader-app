export interface HighlightRange {
  startOffset: number;
  endOffset: number;
}

export class HighlightService {
  updateProgress(progress: number, totalLength: number): HighlightRange {
    const offset = Math.floor(progress * totalLength);
    return { startOffset: offset, endOffset: offset };
  }

  reset(): void {
    // 无状态，无需操作
  }
}
