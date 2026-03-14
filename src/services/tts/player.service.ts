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

  constructor() {
    this.tts = new TTSService();
  }

  async play(text: string, options?: { rate?: number }): Promise<void> {
    const playRate = options?.rate || this.rate;
    await this.tts.synthesize({ text, rate: playRate });
    this.state = PlayerState.PLAYING;
    this.progress = 50;
  }

  pause(): void {
    if (this.state === PlayerState.PLAYING) {
      this.state = PlayerState.PAUSED;
    }
  }

  resume(): void {
    if (this.state === PlayerState.PAUSED) {
      this.state = PlayerState.PLAYING;
    }
  }

  stop(): void {
    this.state = PlayerState.STOPPED;
    this.progress = 0;
  }

  getState(): PlayerState {
    return this.state;
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  getProgress(): number {
    if (this.state === PlayerState.STOPPED) {
      return 0;
    }
    return this.progress;
  }
}
