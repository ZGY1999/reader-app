export interface ParsedChapter {
  id: string;
  title: string;
  content: string;
}

export interface ParsedBook {
  id: string;
  title: string;
  author?: string;
  format: 'txt' | 'epub' | 'pdf';
  content: string;
  chapters: ParsedChapter[];
}
