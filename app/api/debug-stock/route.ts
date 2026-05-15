import type { NextRequest } from 'next/server';
import { probeFinanceEndpoints } from '@/features/market-data/lib/providers/naverFinanceProvider';

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; stock-risk-coach/1.0)',
  Accept: 'application/json',
};

interface NaverStockBasic {
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  fluctuationsRatio?: string;
  accumulatedTradingVolume?: string;
  accumulatedTradingValue?: string;
  marketValue?: string;
  stockExchangeType?: { code?: string };
}

interface NaverPollingResult {
  nm?: string;
  nv?: number;
  cv?: number;
  cr?: number;
  sv?: number;
  am?: number;
  mv?: number;
  dealTrendType?: string;
  stockExchangeType?: { code?: string };
}

interface NaverPollingResponse {
  result?: NaverPollingResult;
}

function parseNumber(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

interface ParsedPrice {
  endpoint: 'primary' | 'polling' | null;
  price: number | null;
  changePercent: number | null;
  name: string | null;
  fallbackUsed: boolean;
  parseError: string | null;
}

async function parsePrimaryPrice(ticker: string): Promise<ParsedPrice> {
  try {
    const res = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { endpoint: 'primary', price: null, changePercent: null, name: null, fallbackUsed: false, parseError: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as NaverStockBasic;
    const price = parseNumber(data.closePrice);
    const priceDiff = parseNumber(data.compareToPreviousClosePrice);
    const ratio = parseNumber(data.fluctuationsRatio);
    const sign = priceDiff !== null && priceDiff < 0 ? -1 : 1;
    const changePercent = ratio !== null ? sign * Math.abs(ratio) : null;
    return {
      endpoint: 'primary',
      price,
      changePercent,
      name: data.stockName?.trim() ?? null,
      fallbackUsed: false,
      parseError: price === null ? 'closePrice missing or unparseable' : null,
    };
  } catch (err) {
    return {
      endpoint: 'primary',
      price: null,
      changePercent: null,
      name: null,
      fallbackUsed: false,
      parseError: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    };
  }
}

async function parsePollingPrice(ticker: string): Promise<ParsedPrice> {
  try {
    const res = await fetch(`https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`, {
      headers: FETCH_HEADERS,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { endpoint: 'polling', price: null, changePercent: null, name: null, fallbackUsed: true, parseError: `HTTP ${res.status}` };
    }
    const wrapper = (await res.json()) as NaverPollingResponse;
    const data = wrapper.result;
    if (!data) {
      return { endpoint: 'polling', price: null, changePercent: null, name: null, fallbackUsed: true, parseError: 'result field missing' };
    }
    const price = typeof data.nv === 'number' ? data.nv : null;
    let changePercent: number | null = typeof data.cr === 'number' ? data.cr : null;
    if (changePercent !== null && data.dealTrendType === 'FALL' && changePercent > 0) {
      changePercent = -changePercent;
    }
    return {
      endpoint: 'polling',
      price,
      changePercent,
      name: data.nm?.trim() ?? null,
      fallbackUsed: true,
      parseError: price === null ? 'nv field missing or not a number' : null,
    };
  } catch (err) {
    return {
      endpoint: 'polling',
      price: null,
      changePercent: null,
      name: null,
      fallbackUsed: true,
      parseError: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    };
  }
}

export interface DebugStockResponse {
  ticker: string;
  primaryEndpoint: { httpStatus: number | null; ok: boolean; responsePreview: string | null; error: string | null };
  pollingEndpoint: { httpStatus: number | null; ok: boolean; responsePreview: string | null; error: string | null };
  primaryParsed: ParsedPrice;
  pollingParsed: ParsedPrice;
  selectedEndpoint: 'primary' | 'polling' | 'none';
  resolvedPrice: number | null;
  resolvedName: string | null;
  fallbackUsed: boolean;
  cacheHit: false; // debug-stock is always fresh — no caching
  cacheAgeMs: null;
}

export async function GET(request: NextRequest): Promise<Response> {
  const ticker = request.nextUrl.searchParams.get('ticker')?.trim() ?? '';
  // noCache accepted but has no effect — debug-stock always fetches fresh
  // (no caching layer applied to this route)

  if (!ticker) {
    return Response.json({ error: 'ticker query param required' }, { status: 400 });
  }

  const [probes, primaryParsed, pollingParsed] = await Promise.all([
    probeFinanceEndpoints(ticker),
    parsePrimaryPrice(ticker),
    parsePollingPrice(ticker),
  ]);

  const primaryProbe = probes.find((p) => p.endpoint === 'primary');
  const pollingProbe = probes.find((p) => p.endpoint === 'polling');

  let selectedEndpoint: 'primary' | 'polling' | 'none' = 'none';
  let resolvedPrice: number | null = null;
  let resolvedName: string | null = null;
  let fallbackUsed = false;

  if (primaryParsed.price !== null) {
    selectedEndpoint = 'primary';
    resolvedPrice = primaryParsed.price;
    resolvedName = primaryParsed.name;
    fallbackUsed = false;
  } else if (pollingParsed.price !== null) {
    selectedEndpoint = 'polling';
    resolvedPrice = pollingParsed.price;
    resolvedName = pollingParsed.name;
    fallbackUsed = true;
  }

  const body: DebugStockResponse = {
    ticker,
    primaryEndpoint: {
      httpStatus: primaryProbe?.httpStatus ?? null,
      ok: primaryProbe?.ok ?? false,
      responsePreview: primaryProbe?.responsePreview ?? null,
      error: primaryProbe?.error ?? null,
    },
    pollingEndpoint: {
      httpStatus: pollingProbe?.httpStatus ?? null,
      ok: pollingProbe?.ok ?? false,
      responsePreview: pollingProbe?.responsePreview ?? null,
      error: pollingProbe?.error ?? null,
    },
    primaryParsed,
    pollingParsed,
    selectedEndpoint,
    resolvedPrice,
    resolvedName,
    fallbackUsed,
    cacheHit: false,
    cacheAgeMs: null,
  };

  return Response.json(body);
}
