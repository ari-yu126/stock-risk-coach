/**
 * Naver Finance unofficial market data provider.
 *
 * Primary endpoint:  https://m.stock.naver.com/api/stock/{ticker}/basic
 * Fallback endpoint: https://polling.finance.naver.com/api/realtime/domestic/stock/{ticker}
 *
 * ⚠️  Both are unofficial, undocumented endpoints.
 *     - No rate-limit SLA guaranteed.
 *     - Field names may change without notice.
 *     - Intended for MVP use only.
 *
 * Replace with KIS Open API (Korea Investment & Securities) for production.
 * See: kisProvider.placeholder.ts for the planned interface.
 *
 * Field source summary:
 *   REAL (from API)      price, changePercent, volume, tradingValue, marketCapBillion, marketType
 *   APPROXIMATED         sector (local map), avgVolume (static baseline — 20-day avg not in quote API)
 */

import type { MarketStock, MarketType } from '../../types';
import type { MarketDataProvider, MarketDataQuery } from './types';

// ── Static lookup tables (data not available in the quote endpoint) ────────────

const TRACKED_TICKERS = [
  '005930', '000660', '042700', '058470', '007660',  // 반도체
  '086520', '247540', '373220', '006400', '003670',  // 2차전지
  '068270', '128940', '196170', '000100',             // 바이오
  '005380', '000270', '012330',                       // 자동차
  '035720', '035420',                                 // 플랫폼
  '277810', '454910',                                 // 로봇
  '329180', '042660',                                 // 조선
  '105560', '086790',                                 // 금융
];

// APPROXIMATED — sector is not returned by the quote API; mapped from KRX listing data.
const TICKER_SECTOR: Record<string, string> = {
  '005930': '반도체', '000660': '반도체', '042700': '반도체', '058470': '반도체', '007660': '반도체',
  '086520': '2차전지', '247540': '2차전지', '373220': '2차전지', '006400': '2차전지', '003670': '2차전지',
  '068270': '바이오',  '128940': '바이오',  '196170': '바이오',  '000100': '바이오',
  '005380': '자동차',  '000270': '자동차',  '012330': '자동차',
  '035720': '플랫폼',  '035420': '플랫폼',
  '277810': '로봇',    '454910': '로봇',
  '329180': '조선',    '042660': '조선',
  '105560': '금융',    '086790': '금융',
};

// APPROXIMATED — 20-day average volume is not in the quote API.
const TICKER_AVG_VOLUME: Record<string, number> = {
  '005930': 10_800_000, '000660': 2_100_000,  '042700': 680_000,  '058470': 92_000,   '007660': 510_000,
  '086520': 158_000,    '247540': 210_000,     '373220': 410_000,  '006400': 480_000,  '003670': 260_000,
  '068270': 1_000_000,  '128940': 95_000,      '196170': 190_000,  '000100': 320_000,
  '005380': 760_000,    '000270': 950_000,     '012330': 310_000,
  '035720': 3_600_000,  '035420': 750_000,
  '277810': 320_000,    '454910': 780_000,
  '329180': 380_000,    '042660': 2_100_000,
  '105560': 1_050_000,  '086790': 780_000,
};

const KOSDAQ_TICKERS = new Set(['042700', '058470', '086520', '247540', '196170', '277810']);

// ── Primary endpoint schema (m.stock.naver.com) ───────────────────────────────

interface NaverStockBasic {
  stockName?: string;
  closePrice?: string;                    // comma-formatted, e.g. "72,400"
  compareToPreviousClosePrice?: string;   // signed, e.g. "+600"
  fluctuationsRatio?: string;             // unsigned, e.g. "0.84"
  accumulatedTradingVolume?: string;
  accumulatedTradingValue?: string;
  marketValue?: string;
  stockExchangeType?: { code?: string };
}

// ── Polling endpoint schema (polling.finance.naver.com) ───────────────────────
// Compact numeric-key format used by Naver's real-time polling API.

interface NaverPollingResult {
  nm?: string;                           // stock name
  nv?: number;                           // current price
  cv?: number;                           // change value vs previous close (signed)
  cr?: number;                           // change rate (signed float, e.g. 0.84 or -1.23)
  sv?: number;                           // trading volume
  am?: number;                           // trading amount in 원
  mv?: number;                           // market cap in 원
  dealTrendType?: string;                // "RISE" | "FALL" | "EVEN"
  stockExchangeType?: { code?: string };
}

interface NaverPollingResponse {
  result?: NaverPollingResult;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseNumber(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function deriveChangePercent(
  fluctuationsRatio: string | undefined,
  priceDiff: number | null,
): number | null {
  const ratio = parseNumber(fluctuationsRatio);
  if (ratio === null) return null;
  const sign = priceDiff !== null && priceDiff < 0 ? -1 : 1;
  return sign * Math.abs(ratio);
}

function resolveMarketType(
  apiCode: string | undefined,
  ticker: string,
): MarketType {
  const code = apiCode?.toUpperCase();
  if (code === 'KOSDAQ') return 'KOSDAQ';
  if (code === 'KOSPI')  return 'KOSPI';
  return KOSDAQ_TICKERS.has(ticker) ? 'KOSDAQ' : 'KOSPI';
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; stock-risk-coach/1.0)',
  Accept: 'application/json',
};

// ── Primary endpoint fetch ────────────────────────────────────────────────────

async function fetchOnePrimary(ticker: string): Promise<MarketStock | null> {
  const url = `https://m.stock.naver.com/api/stock/${ticker}/basic`;

  let res: Response;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS, next: { revalidate: 60 } });
  } catch (err) {
    console.warn(`[naver-finance][primary] ${ticker} → network error:`, err);
    return null;
  }

  console.log(`[naver-finance][primary] ${ticker} → HTTP ${res.status}`);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[naver-finance][primary] ${ticker} error body: ${body.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as NaverStockBasic;

  const name = data.stockName?.trim();
  const price = parseNumber(data.closePrice);
  const priceDiff = parseNumber(data.compareToPreviousClosePrice);
  const volume = parseNumber(data.accumulatedTradingVolume);
  const changePercent = deriveChangePercent(data.fluctuationsRatio, priceDiff);

  if (!name || price === null || volume === null || changePercent === null) {
    console.warn(`[naver-finance][primary] ${ticker} → missing fields`, { name: Boolean(name), price, volume, changePercent });
    return null;
  }

  const rawTradingValue = parseNumber(data.accumulatedTradingValue);
  const tradingValue = rawTradingValue !== null && rawTradingValue > 0
    ? Math.round(rawTradingValue / 100_000_000)
    : Math.round((price * volume) / 100_000_000);

  const rawMarketValue = parseNumber(data.marketValue);
  const marketCapBillion = rawMarketValue !== null && rawMarketValue > 0
    ? Math.round(rawMarketValue / 1_000_000_000)
    : 0;

  return {
    ticker,
    name,
    sector: TICKER_SECTOR[ticker] ?? '기타',
    price,
    changePercent,
    volume,
    avgVolume: TICKER_AVG_VOLUME[ticker] ?? volume,
    marketCapBillion,
    tradingValue,
    marketType: resolveMarketType(data.stockExchangeType?.code, ticker),
    priceSource: 'naver-finance-primary',
  };
}

// ── Polling endpoint fetch (fallback) ─────────────────────────────────────────

async function fetchOnePolling(ticker: string): Promise<MarketStock | null> {
  const url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`;

  let res: Response;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS, next: { revalidate: 60 } });
  } catch (err) {
    console.warn(`[naver-finance][polling] ${ticker} → network error:`, err);
    return null;
  }

  console.log(`[naver-finance][polling] ${ticker} → HTTP ${res.status}`);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn(`[naver-finance][polling] ${ticker} error body: ${body.slice(0, 200)}`);
    return null;
  }

  const wrapper = (await res.json()) as NaverPollingResponse;
  const data = wrapper.result;

  if (!data) {
    console.warn(`[naver-finance][polling] ${ticker} → missing result field`);
    return null;
  }

  const name = data.nm?.trim();
  const price = typeof data.nv === 'number' ? data.nv : null;
  const volume = typeof data.sv === 'number' ? data.sv : null;
  // cr is signed on the polling endpoint; use dealTrendType as tie-breaker when cr === 0
  let changePercent: number | null = typeof data.cr === 'number' ? data.cr : null;
  if (changePercent !== null && data.dealTrendType === 'FALL' && changePercent > 0) {
    changePercent = -changePercent;
  }

  if (!name || price === null || volume === null || changePercent === null) {
    console.warn(`[naver-finance][polling] ${ticker} → missing fields`, { name: Boolean(name), price, volume, changePercent });
    return null;
  }

  const tradingValue = typeof data.am === 'number' && data.am > 0
    ? Math.round(data.am / 100_000_000)
    : Math.round((price * volume) / 100_000_000);

  const marketCapBillion = typeof data.mv === 'number' && data.mv > 0
    ? Math.round(data.mv / 1_000_000_000)
    : 0;

  return {
    ticker,
    name,
    sector: TICKER_SECTOR[ticker] ?? '기타',
    price,
    changePercent,
    volume,
    avgVolume: TICKER_AVG_VOLUME[ticker] ?? volume,
    marketCapBillion,
    tradingValue,
    marketType: resolveMarketType(data.stockExchangeType?.code, ticker),
    priceSource: 'naver-finance-polling',
  };
}

// ── Per-ticker fetch with polling fallback ────────────────────────────────────

async function fetchOne(ticker: string): Promise<MarketStock | null> {
  const primary = await fetchOnePrimary(ticker);
  if (primary) return primary;

  console.log(`[naver-finance] ${ticker} → primary failed, trying polling endpoint`);
  return fetchOnePolling(ticker);
}

// ── Health probe (exported for /api/provider-health) ──────────────────────────

export interface FinanceEndpointProbe {
  endpoint: 'primary' | 'polling';
  url: string;
  httpStatus: number | null;
  ok: boolean;
  responsePreview: string | null; // first 300 chars of raw body, for schema inspection
  error: string | null;
}

export async function probeFinanceEndpoints(ticker: string): Promise<FinanceEndpointProbe[]> {
  const probes: FinanceEndpointProbe[] = [];

  const urls: Array<{ endpoint: 'primary' | 'polling'; url: string }> = [
    { endpoint: 'primary', url: `https://m.stock.naver.com/api/stock/${ticker}/basic` },
    { endpoint: 'polling', url: `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}` },
  ];

  for (const { endpoint, url } of urls) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        cache: 'no-store', // always fresh for health checks
      });
      const body = await res.text();
      probes.push({
        endpoint,
        url,
        httpStatus: res.status,
        ok: res.ok,
        responsePreview: body.slice(0, 300),
        error: null,
      });
    } catch (err) {
      probes.push({
        endpoint,
        url,
        httpStatus: null,
        ok: false,
        responsePreview: null,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
      });
    }
  }

  return probes;
}

// ── Provider export ───────────────────────────────────────────────────────────

export const naverFinanceProvider: MarketDataProvider = {
  async fetchStocks(query: MarketDataQuery = {}): Promise<MarketStock[]> {
    const results = await Promise.allSettled(
      TRACKED_TICKERS.map((ticker) => fetchOne(ticker)),
    );

    let stocks: MarketStock[] = results
      .filter((r): r is PromiseFulfilledResult<MarketStock | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((s): s is MarketStock => s !== null);

    console.log(`[naver-finance] fetchStocks: ${stocks.length}/${TRACKED_TICKERS.length} tickers succeeded`);

    if (stocks.length === 0) {
      throw new Error('[naver-finance] all tickers failed on both endpoints — caller should fallback to mock');
    }

    if (query.sector)     stocks = stocks.filter((s) => s.sector === query.sector);
    if (query.marketType) stocks = stocks.filter((s) => s.marketType === query.marketType);
    if (query.limit)      stocks = stocks.slice(0, query.limit);

    return stocks;
  },
};
