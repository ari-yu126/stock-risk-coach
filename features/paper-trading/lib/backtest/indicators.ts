import type { Candle } from '../candles/types';

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

export function volumes(candles: Candle[]): number[] {
  return candles.map((c) => c.volume);
}

export function sma(values: number[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let sum = 0;
  for (let j = index - period + 1; j <= index; j++) sum += values[j];
  return sum / period;
}

export function highestClose(candles: Candle[], period: number, index: number): number | null {
  if (index < period - 1) return null;
  let max = -Infinity;
  for (let j = index - period + 1; j <= index; j++) {
    max = Math.max(max, candles[j].close);
  }
  return max;
}

/** Wilder RSI at index (needs at least period+1 bars). */
export function rsi(candles: Candle[], period: number, index: number): number | null {
  if (index < period) return null;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
