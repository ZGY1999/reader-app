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

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
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

    const queryEmbedding = await this.embed(query);
    const candidates = this.findNearest(queryEmbedding, topK);

    return candidates.map(node => ({
      chunkId: node.chunkId,
      content: node.content,
      score: this.cosineSimilarity(queryEmbedding, node.embedding)
    }));
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
