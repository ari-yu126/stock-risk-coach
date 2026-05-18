import type { GlobalNewsProvider, RawGlobalArticle } from './types';

interface FinnhubArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  datetime: number; // Unix timestamp (seconds)
  url: string;
  category: string;
}

const FETCH_HEADERS = {
  'User-Agent': 'stock-risk-coach/1.0',
  Accept: 'application/json',
};

export const finnhubNewsProvider: GlobalNewsProvider = {
  async fetchNews(): Promise<RawGlobalArticle[]> {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) throw new Error('FINNHUB_API_KEY not set');

    // Omit key from log to avoid accidental credential exposure in server logs.
    console.log('[finnhub] fetching general market news');

    const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;

    let res: Response;
    try {
      res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' });
    } catch (err) {
      throw new Error(`[finnhub] network error: ${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`[finnhub] news → HTTP ${res.status}`);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`[finnhub] HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const articles = (await res.json()) as FinnhubArticle[];

    if (!Array.isArray(articles)) {
      throw new Error('[finnhub] unexpected response shape — expected array');
    }

    console.log(`[finnhub] received ${articles.length} articles`);

    return articles
      .filter((a) => a.headline?.trim() && a.summary?.trim())
      .slice(0, 60)
      .map((a) => ({
        id: String(a.id),
        title: a.headline.trim(),
        summary: a.summary.trim(),
        source: a.source || 'Finnhub',
        publishedAt: new Date(a.datetime * 1000).toISOString(),
        url: a.url || '',
      }));
  },
};
