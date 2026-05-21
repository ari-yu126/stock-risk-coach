import type { Candle } from '@/features/paper-trading/lib/candles/types';
import { DEFAULT_BACKTEST_CONFIG } from '@/features/paper-trading/lib/backtest/types';
import type { SignalEvaluation, TrackedSignal } from './signalTrackingTypes';
import { loadTrackedSignals, saveTrackedSignals } from './signalLogStore';

const TAKE_PROFIT_PCT = DEFAULT_BACKTEST_CONFIG.takeProfitPercent * 100;
const STOP_LOSS_PCT = DEFAULT_BACKTEST_CONFIG.stopLossPercent * 100;
const MAX_PENDING_DAYS = 12;

function findSignalBarIndex(candles: Candle[], signalDate: string): number {
  let idx = candles.findIndex((c) => c.date === signalDate);
  if (idx >= 0) return idx;
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].date <= signalDate) return i;
  }
  return -1;
}

export function evaluateSignalWithCandles(
  record: TrackedSignal,
  candles: Candle[],
): SignalEvaluation | null {
  const signalIdx = findSignalBarIndex(candles, record.signalDate);
  if (signalIdx < 0) return null;

  const nextIdx = signalIdx + 1;
  if (nextIdx >= candles.length) return null;

  const next = candles[nextIdx];
  if (next.date <= record.signalDate) return null;

  const entry = record.entryPrice;
  const returnPercent = ((next.close - entry) / entry) * 100;
  const maxUpsidePercent = ((next.high - entry) / entry) * 100;
  const maxDownsidePercent = Math.max(0, ((entry - next.low) / entry) * 100);

  const hitTakeProfit = maxUpsidePercent >= TAKE_PROFIT_PCT;
  const hitStopLoss = maxDownsidePercent >= STOP_LOSS_PCT;
  const success = returnPercent > 0 && !hitStopLoss;

  return {
    evalDate: next.date,
    closePrice: next.close,
    returnPercent,
    maxUpsidePercent,
    maxDownsidePercent,
    hitTakeProfit,
    hitStopLoss,
    success,
    evaluatedAt: new Date().toISOString(),
  };
}

function markExpiredIfStale(record: TrackedSignal, candles: Candle[]): TrackedSignal {
  if (record.status !== 'pending') return record;
  const signalIdx = findSignalBarIndex(candles, record.signalDate);
  const lastDate = candles[candles.length - 1]?.date;
  if (!lastDate) return record;

  const daysSince =
    signalIdx >= 0
      ? candles.length - 1 - signalIdx
      : MAX_PENDING_DAYS + 1;

  if (daysSince > MAX_PENDING_DAYS && !evaluateSignalWithCandles(record, candles)) {
    return { ...record, status: 'expired' };
  }
  return record;
}

async function fetchCandles(ticker: string): Promise<Candle[]> {
  const res = await fetch(`/api/candles?ticker=${ticker}&days=90`);
  if (!res.ok) return [];
  const data = (await res.json()) as { candles: Candle[] };
  return data.candles ?? [];
}

/** Evaluate pending signals when the next trading day's candle is available. */
export async function evaluatePendingSignals(): Promise<number> {
  const all = loadTrackedSignals();
  const pending = all.filter((s) => s.status === 'pending');
  if (pending.length === 0) return 0;

  const tickers = [...new Set(pending.map((s) => s.ticker))];
  const candleMap = new Map<string, Candle[]>();

  await Promise.all(
    tickers.map(async (t) => {
      candleMap.set(t, await fetchCandles(t));
    }),
  );

  let evaluated = 0;
  const updated = all.map((record) => {
    if (record.status !== 'pending') return record;

    const candles = candleMap.get(record.ticker) ?? [];
    if (candles.length === 0) return record;

    const staleChecked = markExpiredIfStale(record, candles);
    if (staleChecked.status === 'expired') return staleChecked;

    const evaluation = evaluateSignalWithCandles(record, candles);
    if (!evaluation) return record;

    evaluated++;
    return { ...record, status: 'evaluated' as const, evaluation };
  });

  saveTrackedSignals(updated);
  return evaluated;
}
