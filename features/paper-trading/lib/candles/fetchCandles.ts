import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import type { Candle, CandlesResponse } from './types';

const TICKER_BASE_PRICE: Record<string, number> = {
  '005930': 72_400,
  '000660': 198_500,
  '042700': 92_600,
  '086520': 82_000,
  '035720': 46_800,
  '005380': 245_000,
};

/** Deterministic PRNG for reproducible synthetic series per ticker. */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function parseNaverSiseJson(text: string): Candle[] | null {
  const match = text.match(/\[\[([\s\S]*?)\]\]/);
  if (!match) return null;

  try {
    const rows = JSON.parse(`[[${match[1]}]]`) as unknown[];
    const candles: Candle[] = [];

    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 6) continue;
      const dateNum = Number(row[0]);
      const open = Number(row[1]);
      const high = Number(row[2]);
      const low = Number(row[3]);
      const close = Number(row[4]);
      const volume = Number(row[5]);
      if (!dateNum || !close || close <= 0) continue;

      const ds = String(dateNum);
      const date =
        ds.length === 8
          ? `${ds.slice(0, 4)}-${ds.slice(4, 6)}-${ds.slice(6, 8)}`
          : ds;

      candles.push({ date, open, high, low, close, volume: volume || 0 });
    }

    return candles.length >= 30 ? candles.sort((a, b) => a.date.localeCompare(b.date)) : null;
  } catch {
    return null;
  }
}

export async function fetchNaverDailyCandles(ticker: string, count: number): Promise<Candle[] | null> {
  const url = `https://fchart.stock.naver.com/siseJson.nhn?symbol=${ticker}&requestType=1&timeframe=day&count=${count}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'stock-risk-coach/1.0', Accept: '*/*' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    return parseNaverSiseJson(text);
  } catch {
    return null;
  }
}

export function generateSyntheticCandles(ticker: string, days: number): Candle[] {
  const rand = seededRand(parseInt(ticker, 10) || 12345);
  let price = TICKER_BASE_PRICE[ticker] ?? 50_000;
  const baseVol = 800_000 + (parseInt(ticker.slice(-3), 10) % 500) * 1_000;
  const candles: Candle[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const drift = (rand() - 0.48) * 0.025;
    const open = price;
    const close = Math.max(1000, Math.round(price * (1 + drift)));
    const wick = Math.abs(drift) * price * (0.5 + rand());
    const high = Math.round(Math.max(open, close) + wick * rand());
    const low = Math.round(Math.min(open, close) - wick * rand());
    const volume = Math.round(baseVol * (0.6 + rand() * 1.4));

    candles.push({
      date: d.toISOString().slice(0, 10),
      open,
      high,
      low,
      close,
      volume,
    });
    price = close;
  }

  return candles;
}

export async function fetchCandlesForTicker(ticker: string, days = 120): Promise<CandlesResponse> {
  const naver = await fetchNaverDailyCandles(ticker, days);
  if (naver && naver.length > 0) {
    return {
      ticker,
      name: resolveStockName(ticker),
      candles: naver.slice(-days),
      source: 'naver-fchart',
      days,
    };
  }

  return {
    ticker,
    name: resolveStockName(ticker),
    candles: generateSyntheticCandles(ticker, days),
    source: 'synthetic',
    days,
  };
}

/** @deprecated Use watchlist tickers; kept for tests/scripts. */
export const BACKTEST_TICKERS = ['005930', '000660', '005380', '042700', '086520', '035720'] as const;
