import { LRUCache } from '../../utils/cache';

export interface SearchResult {
  chunkId: string;
  content: string;
  score: number;
}

interface VectorNode {
  id: number;
  chunkId: string;
  content: string;
  embedding: number[];
  neighbors: number[];
}

export class VectorService {
  private apiKey: string;
  private baseURL: string;
  private nodes: Map<number, VectorNode> = new Map();
  private nextId = 0;
  private readonly M = 16; // HNSW 参数：每个节点的最大邻居数
  private embeddingCache: LRUCache<string, number[]>;
  private searchCache: LRUCache<string, SearchResult[]>;

  constructor(apiKey: string, baseURL: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
    this.embeddingCache = new LRUCache(100);
    this.searchCache = new LRUCache(50);
  }

  async embed(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) return cached;

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

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding;
    this.embeddingCache.set(text, embedding);
    return embedding;
  }

  async addChunk(chunkId: string, content: string): Promise<void> {
    const embedding = await this.embed(content);
    const id = this.nextId++;
    const node: VectorNode = { id, chunkId, content, embedding, neighbors: [] };

    // 简化的 HNSW 插入：连接到最近的 M 个节点
    const nearest = this.findNearest(embedding, this.M);
    node.neighbors = nearest.map(n => n.id);

    this.nodes.set(id, node);
  }

  async search(query: string, topK: number): Promise<SearchResult[]> {
    if (this.nodes.size === 0) return [];

    const cacheKey = `${query}:${topK}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const queryEmbedding = await this.embed(query);
    const candidates = this.findNearest(queryEmbedding, topK);

    const results = candidates.map(node => ({
      chunkId: node.chunkId,
      content: node.content,
      score: this.cosineSimilarity(queryEmbedding, node.embedding)
    }));

    this.searchCache.set(cacheKey, results);
    return results;
  }

  async addDocument(bookId: string, chunks: Array<{ id: string; content: string }>): Promise<void> {
    for (const chunk of chunks) {
      await this.addChunk(`${bookId}:${chunk.id}`, chunk.content);
    }
  }

  private findNearest(embedding: number[], k: number): VectorNode[] {
    const scores = Array.from(this.nodes.values()).map(node => ({
      node,
      score: this.cosineSimilarity(embedding, node.embedding)
    }));

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k).map(s => s.node);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('向量维度不一致');
    }
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
