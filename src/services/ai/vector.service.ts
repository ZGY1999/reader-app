export interface SearchResult {
  chunkId: string;
  content: string;
  score: number;
}

interface StoredChunk {
  id: string;
  content: string;
  embedding: number[];
}

export class VectorService {
  private apiKey: string;
  private baseURL: string;
  private chunks: Map<string, StoredChunk> = new Map();

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(`${this.baseURL}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
  }

  async addChunk(chunkId: string, content: string): Promise<void> {
    const embedding = await this.embed(content);
    this.chunks.set(chunkId, { id: chunkId, content, embedding });
  }

  async search(query: string, topK: number): Promise<SearchResult[]> {
    if (this.chunks.size === 0) {
      return [];
    }

    const queryEmbedding = await this.embed(query);
    const scores: Array<{ chunkId: string; content: string; score: number }> = [];

    for (const [chunkId, chunk] of this.chunks) {
      const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      scores.push({ chunkId, content: chunk.content, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
