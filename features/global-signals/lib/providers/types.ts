export interface RawGlobalArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string; // ISO 8601
  url: string;
}

export interface GlobalNewsProvider {
  fetchNews(): Promise<RawGlobalArticle[]>;
}
