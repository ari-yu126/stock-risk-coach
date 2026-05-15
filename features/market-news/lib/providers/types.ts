export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  publishedAt: string; // ISO 8601
  source: string;
  matchedKeywords: string[];
}

export interface NewsQuery {
  keyword: string;
  display?: number;
}

export interface NewsProvider {
  fetchNews(query: NewsQuery): Promise<NewsArticle[]>;
}

export interface QueryDiagnostic {
  keyword: string;
  ok: boolean;
  count: number;         // 0 when failed
  httpStatus?: number;   // present on Naver API errors only
  errorMessage?: string; // present when ok=false
}

export interface NewsResponse {
  articles: NewsArticle[];
  providerType: 'naver' | 'mock';
  fetchedAt: string; // ISO 8601, server time
  fallbackReason: string | null; // null = primary provider used
  queryDiagnostics: QueryDiagnostic[];
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}
