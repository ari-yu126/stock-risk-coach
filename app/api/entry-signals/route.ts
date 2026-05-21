import type { NextRequest } from 'next/server';
import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import { fetchCandlesForTicker } from '@/features/paper-trading/lib/candles/fetchCandles';
import { evaluateEntrySignals, type StockSnapshot } from '@/features/watchlist/lib/entrySignals';
import type { EntrySignalsResponse } from '@/features/watchlist/lib/entrySignalTypes';
import { apiCache } from '@/lib/apiCache';

const CACHE_TTL = 30_000;

async function fetchSignalsForStocks(stocks: StockSnapshot[]): Promise<EntrySignalsResponse> {
  const signals = [];
  let candleSource: 'naver-fchart' | 'synthetic' = 'synthetic';

  for (const stock of stocks) {
    const data = await fetchCandlesForTicker(stock.ticker, 90);
    if (data.source === 'naver-fchart') candleSource = 'naver-fchart';

    const snapshot: StockSnapshot = {
      ticker: stock.ticker,
      name: resolveStockName(stock.ticker, stock.name || data.name),
      changePercent: stock.changePercent,
      volume: stock.volume,
      avgVolume: stock.avgVolume > 0 ? stock.avgVolume : stock.volume,
    };

    signals.push(...evaluateEntrySignals(data.candles, snapshot));
  }

  return {
    signals,
    fetchedAt: new Date().toISOString(),
    candleSource,
  };
}

function cacheKeyForStocks(stocks: StockSnapshot[]): string {
  const parts = stocks
    .map((s) => `${s.ticker}:${s.changePercent.toFixed(1)}:${s.volume}`)
    .sort();
  return `entry-signals:${parts.join('|')}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  const tickersParam = request.nextUrl.searchParams.get('tickers') ?? '';
  const tickers = tickersParam.split(',').map((t) => t.trim()).filter(Boolean);

  if (tickers.length === 0) {
    return Response.json({
      signals: [],
      fetchedAt: new Date().toISOString(),
      candleSource: 'synthetic',
    } satisfies EntrySignalsResponse);
  }

  const stocks: StockSnapshot[] = tickers.map((ticker) => ({
    ticker,
    name: resolveStockName(ticker),
    changePercent: 0,
    volume: 0,
    avgVolume: 0,
  }));

  const cacheKey = cacheKeyForStocks(stocks);
  const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, () => fetchSignalsForStocks(stocks));

  return Response.json({
    ...data,
    cacheHit: meta.hit,
    cacheAgeMs: meta.ageMs,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  let stocks: StockSnapshot[] = [];
  try {
    const body = (await request.json()) as { stocks?: StockSnapshot[] };
    stocks = (body.stocks ?? []).filter((s) => s?.ticker);
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  if (stocks.length === 0) {
    return Response.json({
      signals: [],
      fetchedAt: new Date().toISOString(),
      candleSource: 'synthetic',
    } satisfies EntrySignalsResponse);
  }

  const cacheKey = cacheKeyForStocks(stocks);
  const { data, meta } = await apiCache.fetch(cacheKey, CACHE_TTL, () => fetchSignalsForStocks(stocks));

  return Response.json({
    ...data,
    cacheHit: meta.hit,
    cacheAgeMs: meta.ageMs,
  });
}
