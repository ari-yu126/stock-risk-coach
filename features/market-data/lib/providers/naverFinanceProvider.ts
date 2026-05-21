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

import { resolveStockName } from '../resolveStockName';
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

// ── Shared verbose field schema ───────────────────────────────────────────────
// As of 2026 Q2 both endpoints use the same verbose field names.
// Primary endpoint drops trading volume/value; polling endpoint provides them.

interface NaverVerboseQuote {
  stockName?: string;
  closePrice?: string;                      // comma-formatted, e.g. "270,500"
  compareToPreviousClosePrice?: string;     // signed string, e.g. "-25,500"
  fluctuationsRatio?: string;               // signed string, e.g. "-8.61"
  // Volume/value fields — present in polling, absent in primary as of 2026 Q2
  accumulatedTradingVolume?: string;        // comma-formatted
  accumulatedTradingVolumeRaw?: string;     // plain integer string
  accumulatedTradingValueRaw?: string;      // value in 원 (plain integer string)
  marketValueFull?: string;                 // comma-formatted
  marketValueFullRaw?: string;              // market cap in 원 (plain integer string)
  stockExchangeType?: { code?: string; name?: string };
}

// ── Primary endpoint schema (m.stock.naver.com) ───────────────────────────────
// Alias — primary response is a superset of NaverVerboseQuote.
type NaverStockBasic = NaverVerboseQuote;

// ── Polling endpoint schema (polling.finance.naver.com) ───────────────────────
// As of 2026 Q2 the response is { "datas": [NaverVerboseQuote] }.
// (Previous format used compact keys nm/nv/cr/sv/am/mv — no longer returned.)
interface NaverPollingResponse {
  datas?: NaverVerboseQuote[];
  result?: NaverVerboseQuote;   // legacy shape, kept for forward compat
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
  // fluctuationsRatio is signed as of 2026 Q2 (e.g., "-8.61").
  // Fall back to deriving sign from priceDiff for older responses where it was unsigned.
  if (ratio !== 0) return ratio;
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
    // cache: 'no-store' — apiCache at the route level owns caching; per-fetch revalidate is redundant.
    res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' });
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
  const changePercent = deriveChangePercent(data.fluctuationsRatio, priceDiff);

  if (!name || price === null || changePercent === null) {
    console.warn(`[naver-finance][primary] ${ticker} → missing core fields`, { name: Boolean(name), price, changePercent });
    return null;
  }

  // accumulatedTradingVolume dropped from primary endpoint as of 2026 Q2; fall back to static avg.
  const volume = parseNumber(data.accumulatedTradingVolumeRaw ?? data.accumulatedTradingVolume)
    ?? TICKER_AVG_VOLUME[ticker]
    ?? 0;

  const rawTradingValue = parseNumber(data.accumulatedTradingValueRaw);
  const tradingValue = rawTradingValue !== null && rawTradingValue > 0
    ? Math.round(rawTradingValue / 100_000_000)
    : Math.round((price * volume) / 100_000_000);

  const rawMarketValue = parseNumber(data.marketValueFullRaw);
  const marketCapBillion = rawMarketValue !== null && rawMarketValue > 0
    ? Math.round(rawMarketValue / 1_000_000_000)
    : 0;

  return {
    ticker,
    name: resolveStockName(ticker, name),
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
    res = await fetch(url, { headers: FETCH_HEADERS, cache: 'no-store' });
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
  // Current format: { datas: [NaverVerboseQuote] }. Legacy: { result: NaverVerboseQuote }.
  const data = wrapper.datas?.[0] ?? wrapper.result ?? null;

  if (!data) {
    console.warn(`[naver-finance][polling] ${ticker} → missing datas/result field`);
    return null;
  }

  const name = data.stockName?.trim();
  const price = parseNumber(data.closePrice);
  const priceDiff = parseNumber(data.compareToPreviousClosePrice);
  const changePercent = deriveChangePercent(data.fluctuationsRatio, priceDiff);

  if (!name || price === null || changePercent === null) {
    console.warn(`[naver-finance][polling] ${ticker} → missing core fields`, { name: Boolean(name), price, changePercent });
    return null;
  }

  const volume = parseNumber(data.accumulatedTradingVolumeRaw ?? data.accumulatedTradingVolume)
    ?? TICKER_AVG_VOLUME[ticker]
    ?? 0;

  const rawTradingValue = parseNumber(data.accumulatedTradingValueRaw);
  const tradingValue = rawTradingValue !== null && rawTradingValue > 0
    ? Math.round(rawTradingValue / 100_000_000)
    : Math.round((price * volume) / 100_000_000);

  const rawMarketValue = parseNumber(data.marketValueFullRaw);
  const marketCapBillion = rawMarketValue !== null && rawMarketValue > 0
    ? Math.round(rawMarketValue / 1_000_000_000)
    : 0;

  return {
    ticker,
    name: resolveStockName(ticker, name),
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

// ── Concurrency-limited batch fetch ───────────────────────────────────────────
// Firing all TRACKED_TICKERS concurrently triggers Naver's rate-limiter / bot
// detection. Process in batches of BATCH_SIZE; each batch is fully settled
// before the next starts.

const BATCH_SIZE = 5;

async function fetchBatched(tickers: string[]): Promise<MarketStock[]> {
  const stocks: MarketStock[] = [];
  // Index symbols (non-6-digit) are not fetchable via the stock endpoint.
  const fetchable = tickers.filter((t) => /^\d{6}$/.test(t));

  for (let i = 0; i < fetchable.length; i += BATCH_SIZE) {
    const batch = fetchable.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((t) => fetchOne(t)));
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value !== null) stocks.push(r.value);
    }
  }

  return stocks;
}

// ── Provider export ───────────────────────────────────────────────────────────

export const naverFinanceProvider: MarketDataProvider = {
  async fetchStocks(query: MarketDataQuery = {}): Promise<MarketStock[]> {
    const tickersToFetch = query.tickers ?? TRACKED_TICKERS;
    const fetchable = tickersToFetch.filter((t) => /^\d{6}$/.test(t));
    let stocks = await fetchBatched(tickersToFetch);

    console.log(`[naver-finance] fetchStocks: ${stocks.length}/${fetchable.length} fetchable tickers succeeded`);

    if (stocks.length === 0) {
      throw new Error('[naver-finance] all tickers failed on both endpoints — caller should fallback to mock');
    }

    if (query.sector)     stocks = stocks.filter((s) => s.sector === query.sector);
    if (query.marketType) stocks = stocks.filter((s) => s.marketType === query.marketType);
    if (query.limit)      stocks = stocks.slice(0, query.limit);

    return stocks;
  },
};
