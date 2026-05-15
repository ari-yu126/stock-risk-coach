import type { NextRequest } from 'next/server';
import { getNewsProvider } from '@/features/market-news/lib/providers/getNewsProvider';
import { mockNewsProvider } from '@/features/market-news/lib/providers/mockNewsProvider';
import { getMarketDataProvider, getMockMarketDataProvider } from '@/features/market-data/lib/providers/getMarketDataProvider';
import type { NewsArticle, NewsProvider } from '@/features/market-news/lib/providers/types';
import type { MarketDataProviderType } from '@/features/market-data/lib/providers/types';
import { detectThemes } from '@/features/market-news/lib/themeDetection';
import { discoverCandidates, type StockCandidate } from '@/features/market-news/lib/candidateDiscovery';
import { apiCache } from '@/lib/apiCache';

const QUERIES = ['국내 증시', '반도체', '2차전지', '바이오', 'AI 데이터센터', '자동차'];
const DISPLAY_PER_QUERY = 8;
const CACHE_TTL = 30 * 1000; // 30 seconds

async function fetchAllNews(provider: NewsProvider, label: string): Promise<NewsArticle[]> {
  const settled = await Promise.allSettled(
    QUERIES.map((keyword) => provider.fetchNews({ keyword, display: DISPLAY_PER_QUERY })),
  );
  const merged: NewsArticle[] = [];
  for (const [i, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      console.log(`[candidates][${label}] "${QUERIES[i]}" → ${result.value.length} articles`);
      merged.push(...result.value);
    } else {
      console.error(`[candidates][${label}] "${QUERIES[i]}" failed:`, result.reason);
    }
  }
  return merged;
}

export interface CandidatesResponse {
  candidates: StockCandidate[];
  newsProviderType: 'naver' | 'mock';
  marketProviderType: MarketDataProviderType;
  fetchedAt: string; // ISO 8601, server time
  newsFallbackReason: string | null;
  marketFallbackReason: string | null;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}

async function fetchFresh(): Promise<Omit<CandidatesResponse, 'cacheHit' | 'cacheAgeMs'>> {
  const hasClientId = Boolean(process.env.NAVER_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.NAVER_CLIENT_SECRET);
  const { provider: newsProvider, providerType: newsProviderType } = getNewsProvider();
  const { provider: marketProvider, providerType: marketProviderType } = getMarketDataProvider();

  console.log('[candidates] init →', { hasClientId, hasClientSecret, newsProviderType, marketProviderType });

  // ── News: fetch with mock fallback ───────────────────────────────────────────
  let newsFallbackReason: string | null = null;
  let resolvedNewsType: 'naver' | 'mock' = newsProviderType;

  let articles: NewsArticle[];

  if (newsProviderType === 'mock') {
    newsFallbackReason = 'no-credentials: NAVER_CLIENT_ID or NAVER_CLIENT_SECRET not set in env';
    console.warn(`[candidates] news: using mock — ${newsFallbackReason}`);
    articles = await fetchAllNews(newsProvider, 'mock');
  } else {
    articles = await fetchAllNews(newsProvider, 'naver');
    console.log(`[candidates] news: naver total ${articles.length} articles`);

    if (articles.length === 0) {
      newsFallbackReason = 'naver-returned-0: all queries returned empty or failed — check credentials and API quota';
      console.warn(`[candidates] news: ${newsFallbackReason}`);
      articles = await fetchAllNews(mockNewsProvider, 'mock-fallback');
      resolvedNewsType = 'mock';
    }
  }

  // ── Market data: fetch — no mock fallback when naver-finance is configured ───
  // Mixing mock prices with live news would produce misleading candidates.
  // If naver-finance fails entirely, return zero candidates rather than fake prices.
  let marketFallbackReason: string | null = null;
  let resolvedMarketType: MarketDataProviderType = marketProviderType;
  let stocks: Awaited<ReturnType<typeof marketProvider.fetchStocks>>;

  try {
    stocks = await marketProvider.fetchStocks();
    console.log(`[candidates] market: ${marketProviderType} → ${stocks.length} stocks`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    if (marketProviderType === 'naver-finance') {
      // Refuse mock fallback — caller sees empty candidates with fallback explanation
      marketFallbackReason = `naver-finance-error: ${errMsg}`;
      console.warn('[candidates] market: Naver Finance failed — serving zero stocks to avoid mock price contamination:', errMsg);
      stocks = [];
    } else {
      // Provider is already mock; unexpected throw — surface it
      marketFallbackReason = `mock-error: ${errMsg}`;
      console.warn('[candidates] market: mock provider failed:', errMsg);
      const { provider: mock, providerType: mockType } = getMockMarketDataProvider();
      stocks = await mock.fetchStocks();
      resolvedMarketType = mockType;
      console.log(`[candidates] market: mock-retry → ${stocks.length} stocks`);
    }
  }

  // ── Discovery ─────────────────────────────────────────────────────────────────
  const themes = detectThemes(articles);
  const candidates = discoverCandidates(themes, stocks);
  console.log(`[candidates] discovered ${candidates.length} candidates from ${themes.length} themes`);

  return {
    candidates,
    newsProviderType: resolvedNewsType,
    marketProviderType: resolvedMarketType,
    fetchedAt: new Date().toISOString(),
    newsFallbackReason,
    marketFallbackReason,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const noCache = searchParams.get('noCache') === '1';

  // Build cache key from all params except the cache-control directive itself.
  const keyParams = new URLSearchParams(searchParams);
  keyParams.delete('noCache');
  const cacheKey = `candidates:${keyParams.toString()}`;

  if (noCache) {
    console.log('[candidates] noCache=1 — bypassing cache');
    const data = await fetchFresh();
    const body: CandidatesResponse = { ...data, cacheHit: false, cacheAgeMs: null };
    return Response.json(body);
  }

  const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, fetchFresh);
  console.log(`[candidates] cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'} key="${cacheKey}"`);

  const body: CandidatesResponse = { ...data, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
  return Response.json(body);
}
