declare module 'flexsearch' {
  export namespace FlexSearch {
    interface IndexOptions {
      tokenize?: string;
      charset?: string;
      language?: string;
    }

    class Index {
      constructor(options?: IndexOptions);
      add(id: number | string, text: string): void;
      search(query: string, limit?: number): Array<number | string>;
      remove(id: number | string): void;
    }
  }

  export = FlexSearch;
}
