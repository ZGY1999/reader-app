import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: number;
}

export class TTSService {
  private tts: MsEdgeTTS;

  constructor() {
    this.tts = new MsEdgeTTS();
  }

  async synthesize(options: TTSOptions): Promise<Buffer> {
    if (!options.text) {
      throw new Error('文本不能为空');
    }

    const voice = options.voice || 'zh-CN-XiaoxiaoNeural';
    const rate = options.rate || 1.0;
    const rateStr = rate !== 1.0 ? `${(rate - 1) * 100}%` : '+0%';

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

      audioStream.on('close', () => {
        if (chunks.length === 0) {
          resolve(Buffer.alloc(0));
        }
      });

      audioStream.on('error', reject);
    });
  }
}
