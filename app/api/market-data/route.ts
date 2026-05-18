import type { NextRequest } from 'next/server';
import { getMarketDataProvider, getMockMarketDataProvider } from '@/features/market-data/lib/providers/getMarketDataProvider';
import type { MarketDataQuery } from '@/features/market-data/lib/providers/types';
import type { MarketDataResponse } from '@/features/market-data/lib/providers/types';
import { apiCache } from '@/lib/apiCache';

const CACHE_TTL = 30 * 1000; // 30 seconds

async function fetchFresh(
  query: MarketDataQuery,
): Promise<Omit<MarketDataResponse, 'cacheHit' | 'cacheAgeMs'>> {
  const { provider, providerType } = getMarketDataProvider();
  const fetchedAt = new Date().toISOString();

  console.log('[market-data] fetching fresh →', { providerType, query });

  try {
    const stocks = await provider.fetchStocks(query);
    console.log(`[market-data] naver-finance → ${stocks.length} stocks`);
    return { stocks, providerType, fetchedAt, fallbackReason: null };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    const fallbackReason = `naver-finance-error: ${errMsg}`;
    console.warn('[market-data] Naver Finance failed, falling back to mock:', errMsg);
    const { provider: mock, providerType: mockType } = getMockMarketDataProvider();
    const stocks = await mock.fetchStocks(query);
    console.log(`[market-data] mock-fallback → ${stocks.length} stocks`);
    return { stocks, providerType: mockType, fetchedAt, fallbackReason };
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const sector = searchParams.get('sector') ?? undefined;
  const marketType = searchParams.get('marketType') as 'KOSPI' | 'KOSDAQ' | null ?? undefined;
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
  const noCache = searchParams.get('noCache') === '1';

  const tickersParam = searchParams.get('tickers');
  const tickers = tickersParam
    ? tickersParam.split(',').map((t) => t.trim()).filter((t) => /^\d{1,6}$/.test(t)).sort()
    : undefined;

  const query: MarketDataQuery = { sector, marketType, limit, tickers };
  const cacheKey = `market-data:${JSON.stringify(query)}`;

  if (noCache) {
    console.log('[market-data] noCache=1 — bypassing cache');
    const data = await fetchFresh(query);
    const body: MarketDataResponse = { ...data, cacheHit: false, cacheAgeMs: null };
    return Response.json(body);
  }

  const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, () => fetchFresh(query));
  console.log(`[market-data] cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'}`);

  const body: MarketDataResponse = { ...data, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
  return Response.json(body);
}
