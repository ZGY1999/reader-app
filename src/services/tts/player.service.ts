import { TTSService } from './tts.service';

export enum PlayerState {
  STOPPED = 'stopped',
  PLAYING = 'playing',
  PAUSED = 'paused'
}

export class PlayerService {
  private state: PlayerState = PlayerState.STOPPED;
  private tts: TTSService;
  private rate: number = 1.0;
  private progress: number = 0;
  private startTime: number = 0;
  private estimatedDuration: number = 0;

  constructor(tts?: TTSService) {
    this.tts = tts || new TTSService();
  }

  async play(text: string, options?: { rate?: number }): Promise<void> {
    try {
      const playRate = options?.rate || this.rate;
      await this.tts.synthesize({ text, rate: playRate });
      this.state = PlayerState.PLAYING;
      this.startTime = Date.now();
      this.estimatedDuration = text.length * 60;
    } catch (error) {
      this.state = PlayerState.STOPPED;
      throw error;
    }
  }

  pause(): void {
    if (this.state === PlayerState.PLAYING) {
      this.progress = this.getProgress();
      this.state = PlayerState.PAUSED;
    }
  }

  resume(): void {
    if (this.state !== PlayerState.PAUSED) {
      throw new Error('只能在暂停状态下恢复播放');
    }
    this.state = PlayerState.PLAYING;
  }

  stop(): void {
    this.state = PlayerState.STOPPED;
    this.progress = 0;
  }

  getState(): PlayerState {
    return this.state;
  }

  setRate(rate: number): void {
    if (rate < 0.5 || rate > 2.0) {
      throw new Error('语速必须在 0.5 到 2.0 之间');
    }
    this.rate = rate;
  }

  getProgress(): number {
    if (this.state === PlayerState.STOPPED) {
      return 0;
    }
    if (this.state === PlayerState.PAUSED) {
      return this.progress;
    }
    const elapsed = Date.now() - this.startTime;
    this.progress = Math.min(100, (elapsed / this.estimatedDuration) * 100);
    return this.progress;
  }
}
