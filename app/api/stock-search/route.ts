import type { NextRequest } from 'next/server';
import { apiCache } from '@/lib/apiCache';
import { searchAll, STOCK_CATALOG } from '@/features/market-data/data/stockCatalog';
import { ETF_CATALOG } from '@/features/market-data/data/etfCatalog';
import { INDEX_CATALOG } from '@/features/market-data/data/indexCatalog';

export interface StockSearchResult {
  ticker: string;
  name: string;
  marketType: 'KOSPI' | 'KOSDAQ' | '기타';
  type: 'stock' | 'etf' | 'index';
}

export interface StockSearchResponse {
  results: StockSearchResult[];
  query: string;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
  source: 'local-catalog';
  totalCatalogSize: number;
}

const ALL_CATALOGS = [
  ...STOCK_CATALOG.map((e) => ({ ...e, type: 'stock' as const })),
  ...ETF_CATALOG,
  ...INDEX_CATALOG,
];

const CACHE_TTL = 60 * 60 * 1000; // 1 hour — catalog is static

function runSearch(q: string): Pick<StockSearchResponse, 'results' | 'source' | 'totalCatalogSize'> {
  const matches = searchAll(q, ALL_CATALOGS, 20);
  return {
    results: matches.map((e) => ({
      ticker: e.ticker,
      name: e.name,
      marketType: e.marketType,
      type: e.type ?? 'stock',
    })),
    source: 'local-catalog',
    totalCatalogSize: ALL_CATALOGS.length,
  };
}

export async function GET(request: NextRequest): Promise<Response> {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const noCache = request.nextUrl.searchParams.get('noCache') === '1';

  if (q.length < 1) {
    const body: StockSearchResponse = {
      results: [], query: q, cacheHit: false, cacheAgeMs: null,
      source: 'local-catalog', totalCatalogSize: STOCK_CATALOG.length,
    };
    return Response.json(body);
  }

  const cacheKey = `stock-search:${q.toLowerCase()}`;

  if (noCache) {
    console.log(`[stock-search] "${q}" noCache=1`);
    const { results, source, totalCatalogSize } = runSearch(q);
    const body: StockSearchResponse = { results, query: q, cacheHit: false, cacheAgeMs: null, source, totalCatalogSize };
    return Response.json(body);
  }

  const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, () => Promise.resolve(runSearch(q)));
  console.log(`[stock-search] "${q}" cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'}`);

  const body: StockSearchResponse = { ...data, query: q, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
  return Response.json(body);
}
