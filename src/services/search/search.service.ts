import FlexSearch from 'flexsearch';

export interface SearchResult {
  text: string;
  position: number;
}

export class SearchService {
  private indexes: Map<string, FlexSearch.Index> = new Map();
  private contents: Map<string, string> = new Map();

  async buildIndex(bookId: string, content: string): Promise<void> {
    const index = new FlexSearch.Index({
      tokenize: 'full'
    });

    index.add(0, content);
    this.indexes.set(bookId, index);
    this.contents.set(bookId, content);
  }

  async search(bookId: string, query: string): Promise<SearchResult[]> {
    const index = this.indexes.get(bookId);
    const content = this.contents.get(bookId);

    if (!index || !content) return [];

    const results = index.search(query);
    if (results.length === 0) return [];

    const matches: SearchResult[] = [];
    let pos = content.indexOf(query);

    while (pos !== -1) {
      matches.push({ text: query, position: pos });
      pos = content.indexOf(query, pos + 1);
    }

    return matches;
  }
}
