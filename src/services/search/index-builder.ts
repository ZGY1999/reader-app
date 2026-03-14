import FlexSearch from 'flexsearch';

export interface ChunkSearchResult {
  text: string;
  chunkIndex: number;
  position: number;
}

export class IndexBuilder {
  private indexes: Map<string, FlexSearch.Index> = new Map();
  private chunks: Map<string, string[]> = new Map();

  async buildFromChunks(bookId: string, chunks: string[]): Promise<void> {
    const index = new FlexSearch.Index({ tokenize: 'full' });

    chunks.forEach((chunk, i) => {
      index.add(i, chunk);
    });

    this.indexes.set(bookId, index);
    this.chunks.set(bookId, chunks);
  }

  async search(bookId: string, query: string): Promise<ChunkSearchResult[]> {
    const index = this.indexes.get(bookId);
    const chunks = this.chunks.get(bookId);

    if (!index || !chunks) return [];

    const results = index.search(query) as number[];

    return results.map(chunkIndex => {
      const text = chunks[chunkIndex];
      const position = text.indexOf(query);
      return { text, chunkIndex, position };
    });
  }
}
