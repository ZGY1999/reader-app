import { BookHandler } from './book.handler';
import { SettingsHandler } from './settings.handler';
import { ChatService } from '../../services/ai/chat.service';
import { ChunkerService } from '../../services/ai/chunker.service';
import { VectorService, SearchResult } from '../../services/ai/vector.service';

interface AIConfig {
  apiKey: string;
  baseURL: string;
}

interface Citation {
  chunkId: string;
  chapterId?: string;
  chapterTitle: string;
  text: string;
  startOffset: number;
  endOffset: number;
  score: number;
}

interface CitationMetadata {
  chunkId: string;
  chapterId?: string;
  chapterTitle: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

type VectorFactory = (apiKey: string, baseURL: string) => VectorService;
type ChatFactory = (apiKey: string, baseURL: string, vectorService: VectorService) => ChatService;

export class AIHandler {
  private readonly chunker = new ChunkerService();
  private readonly indexedBooks = new Set<string>();
  private readonly citationIndex = new Map<string, CitationMetadata>();
  private vectorService: VectorService | null = null;
  private chatService: ChatService | null = null;
  private currentConfigKey: string | null = null;

  constructor(
    private readonly bookHandler: BookHandler,
    private readonly settingsHandler: SettingsHandler,
    private readonly vectorFactory: VectorFactory = (apiKey, baseURL) => new VectorService(apiKey, baseURL),
    private readonly chatFactory: ChatFactory = (apiKey, baseURL, vectorService) => new ChatService(apiKey, baseURL, vectorService),
  ) {}

  async getStatus() {
    const config = await this.loadConfig();
    return { configured: Boolean(config?.apiKey) };
  }

  async ask(options: { bookId: string; question: string }) {
    try {
      const services = await this.ensureServices();
      if (!services) {
        return {
          success: false as const,
          code: 'NOT_CONFIGURED' as const,
          error: '请先在设置中配置 AI API Key',
        };
      }

      await this.ensureBookIndexed(options.bookId, services.vectorService);

      const [answer, results] = await Promise.all([
        services.chatService.chat(options),
        services.vectorService.search(options.question, 3),
      ]);

      return {
        success: true as const,
        answer,
        citations: results
          .map((result) => this.buildCitation(result))
          .filter((citation): citation is Citation => citation !== null),
      };
    } catch (error) {
      return {
        success: false as const,
        code: 'REQUEST_FAILED' as const,
        error: error instanceof Error ? error.message : 'AI 请求失败',
      };
    }
  }

  private async ensureServices() {
    const config = await this.loadConfig();
    if (!config?.apiKey) {
      return null;
    }

    const nextConfigKey = `${config.apiKey}::${config.baseURL}`;
    if (!this.vectorService || !this.chatService || this.currentConfigKey !== nextConfigKey) {
      this.vectorService = this.vectorFactory(config.apiKey, config.baseURL);
      this.chatService = this.chatFactory(config.apiKey, config.baseURL, this.vectorService);
      this.currentConfigKey = nextConfigKey;
      this.indexedBooks.clear();
      this.citationIndex.clear();
    }

    return {
      vectorService: this.vectorService,
      chatService: this.chatService,
    };
  }

  private async loadConfig(): Promise<AIConfig | null> {
    const settings = await this.settingsHandler.getAllSettings();
    const apiKey = (settings.aiApiKey || process.env.OPENAI_API_KEY || '').trim();
    const baseURL = (settings.aiBaseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').trim();

    if (!apiKey) {
      return null;
    }

    return { apiKey, baseURL };
  }

  private async ensureBookIndexed(bookId: string, vectorService: VectorService) {
    if (this.indexedBooks.has(bookId)) {
      return;
    }

    const payload = await this.bookHandler.getBookContent(bookId);
    const chapterTitleMap = new Map(payload.chapters.map((chapter) => [chapter.id, chapter.title]));

    let chunks = this.chunker.chunkByChapter(payload.chapters, bookId);
    if (chunks.length === 0 && payload.content.trim()) {
      chunks = this.chunker.chunkByParagraph(payload.content, bookId);
    }

    const documentChunks = chunks.map((chunk, index) => {
      const normalizedId = `chunk-${index + 1}`;
      const chunkId = `${bookId}:${normalizedId}`;
      this.citationIndex.set(chunkId, {
        chunkId,
        chapterId: chunk.chapterId,
        chapterTitle: chunk.chapterId ? chapterTitleMap.get(chunk.chapterId) || '全文' : '全文',
        text: chunk.content,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
      });

      return {
        id: normalizedId,
        content: chunk.content,
      };
    });

    if (documentChunks.length > 0) {
      await vectorService.addDocument(bookId, documentChunks);
    }

    this.indexedBooks.add(bookId);
  }

  private buildCitation(result: SearchResult): Citation | null {
    const metadata = this.citationIndex.get(result.chunkId);
    if (!metadata) {
      return null;
    }

    return {
      ...metadata,
      score: result.score,
    };
  }
}
