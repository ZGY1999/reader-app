import { webcrypto } from 'crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: number;
}

export class TTSService {
  private tts: MsEdgeTTS;

  constructor() {
    if (!globalThis.crypto) {
      Object.defineProperty(globalThis, 'crypto', {
        value: webcrypto,
        configurable: true,
      });
    }
    this.tts = new MsEdgeTTS();
  }

  async synthesize(options: TTSOptions): Promise<Buffer> {
    if (!options.text) {
      throw new Error('文本不能为空');
    }

    if (options.rate !== undefined && (options.rate < 0.5 || options.rate > 2.0)) {
      throw new Error('语速必须在 0.5 到 2.0 之间');
    }

    const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
    const rate = options.rate || 1.0;
    const rateStr = rate !== 1.0
      ? `${rate >= 1 ? '+' : ''}${((rate - 1) * 100).toFixed(0)}%`
      : '+0%';

    await this.tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = this.tts.toStream(options.text, { rate: rateStr });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      audioStream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      audioStream.on('error', reject);
    });
  }
}
