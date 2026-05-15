import { NewsArticle, NewsProvider, NewsQuery } from './types';

interface NaverNewsItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string; // RFC 2822: "Mon, 14 May 2026 09:00:00 +0900"
}

interface NaverNewsResponse {
  items: NaverNewsItem[];
}

// Structured error so callers can extract httpStatus without string-parsing.
export class NaverNewsApiError extends Error {
  constructor(
    public readonly keyword: string,
    public readonly httpStatus: number,
    public readonly errorBody: string,
  ) {
    super(`Naver News API ${httpStatus} for "${keyword}"`);
    this.name = 'NaverNewsApiError';
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function extractSource(originallink: string): string {
  try {
    const hostname = new URL(originallink).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '네이버 뉴스';
  }
}

function normalizeItem(item: NaverNewsItem, keyword: string): NewsArticle {
  return {
    title: stripHtml(item.title),
    description: stripHtml(item.description),
    link: item.link,
    publishedAt: new Date(item.pubDate).toISOString(),
    source: extractSource(item.originallink),
    matchedKeywords: [keyword],
  };
}

export const naverNewsProvider: NewsProvider = {
  async fetchNews({ keyword, display = 10 }: NewsQuery): Promise<NewsArticle[]> {
    const url = new URL('https://openapi.naver.com/v1/search/news.json');
    url.searchParams.set('query', keyword);
    url.searchParams.set('display', String(display));
    url.searchParams.set('sort', 'date');

    const response = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID ?? '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET ?? '',
      },
      next: { revalidate: 300 },
    });

    console.log(`[naver-news] keyword="${keyword}" → HTTP ${response.status}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[naver-news] keyword="${keyword}" error body: ${body.slice(0, 300)}`);
      throw new NaverNewsApiError(keyword, response.status, body);
    }

    const data: NaverNewsResponse = await response.json();
    console.log(`[naver-news] keyword="${keyword}" → ${data.items.length} items`);
    return data.items.map((item) => normalizeItem(item, keyword));
  },
};
