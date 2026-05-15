import type { NextRequest } from 'next/server';
import { apiCache } from '@/lib/apiCache';

export interface StockSearchResult {
  ticker: string;
  name: string;
  marketType: 'KOSPI' | 'KOSDAQ' | '기타';
}

export interface StockSearchResponse {
  results: StockSearchResult[];
  query: string;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}

// Naver Finance autocomplete API (unofficial)
const NAVER_FINANCE_SEARCH_URL = 'https://ac.finance.naver.com/api/search';
const CACHE_TTL = 60 * 60 * 1000; // 1 hour — search results are stable

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; stock-risk-coach/1.0)',
  Accept: 'application/json',
  Referer: 'https://finance.naver.com/',
};

interface NaverFinanceSearchItem {
  cd?: string;
  nm?: string;
  nv?: string;
  marketType?: string;
}

type NaverSearchArrayItem = string[];

interface NaverFinanceSearchResponse {
  resultcode?: string;
  result?: {
    query?: string;
    items?: NaverSearchArrayItem[] | NaverFinanceSearchItem[];
  };
  0?: string;
}

function normalizeMarketType(raw: string | undefined): StockSearchResult['marketType'] {
  const upper = raw?.toUpperCase() ?? '';
  if (upper === 'KOSPI' || upper === 'KOSPI200' || upper === 'KPI') return 'KOSPI';
  if (upper === 'KOSDAQ' || upper === 'KSQ' || upper === 'KOSDAQ_GLOBAL') return 'KOSDAQ';
  return '기타';
}

async function searchNaverFinance(query: string): Promise<StockSearchResult[]> {
  const url = new URL(NAVER_FINANCE_SEARCH_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('target', 'stock');

  const res = await fetch(url.toString(), { headers: FETCH_HEADERS, cache: 'no-store' });

  if (!res.ok) {
    console.warn(`[stock-search] Naver Finance search HTTP ${res.status}`);
    return [];
  }

  const raw = await res.text();
  console.log(`[stock-search] raw response (first 400): ${raw.slice(0, 400)}`);

  let data: NaverFinanceSearchResponse;
  try {
    data = JSON.parse(raw) as NaverFinanceSearchResponse;
  } catch {
    console.warn('[stock-search] failed to parse JSON response');
    return [];
  }

  const items = data?.result?.items ?? [];
  const results: StockSearchResult[] = [];

  for (const item of items) {
    if (Array.isArray(item)) {
      const [name, ticker, marketRaw] = item as string[];
      if (!ticker || !name) continue;
      results.push({ ticker, name, marketType: normalizeMarketType(marketRaw) });
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as NaverFinanceSearchItem;
      if (!obj.cd || !obj.nm) continue;
      results.push({ ticker: obj.cd, name: obj.nm, marketType: normalizeMarketType(obj.marketType) });
    }
  }

  return results.filter((r) => r.marketType !== '기타').slice(0, 10);
}

export async function GET(request: NextRequest): Promise<Response> {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';

  if (q.length < 1) {
    const body: StockSearchResponse = { results: [], query: q, cacheHit: false, cacheAgeMs: null };
    return Response.json(body);
  }

  const cacheKey = `stock-search:${q.toLowerCase()}`;

  try {
    const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, () => searchNaverFinance(q));
    console.log(`[stock-search] "${q}" cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'}`);
    const body: StockSearchResponse = { results: data, query: q, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
    return Response.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    console.error('[stock-search] error:', msg);
    const body: StockSearchResponse = { results: [], query: q, cacheHit: false, cacheAgeMs: null };
    return Response.json(body, { status: 500 });
  }
}
