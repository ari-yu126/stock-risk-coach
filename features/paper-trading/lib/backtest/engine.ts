import type { Candle } from '../candles/types';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestTrade,
  EquityPoint,
  StrategyId,
} from './types';
import { DEFAULT_BACKTEST_CONFIG, STRATEGY_WARMUP_BARS } from './types';
import { entrySignals, exitSignals } from './strategies';

interface OpenPosition {
  entryIndex: number;
  entryPrice: number;
  shares: number;
}

export function runBacktest(
  candles: Candle[],
  strategyId: StrategyId,
  config: BacktestConfig = DEFAULT_BACKTEST_CONFIG,
): BacktestResult {
  const entry = entrySignals[strategyId];
  const exitSignal = exitSignals[strategyId];
  const trades: BacktestTrade[] = [];
  const equityCurve: EquityPoint[] = [];

  let cash = config.initialCapital;
  let position: OpenPosition | null = null;

  const minBars = STRATEGY_WARMUP_BARS[strategyId];
  let cooldownUntil = minBars;

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];

    if (position) {
      const holdDays = i - position.entryIndex;
      const ret = (bar.close - position.entryPrice) / position.entryPrice;

      let shouldExit = false;
      let reason: BacktestTrade['exitReason'] = 'signal';

      if (ret <= -config.stopLossPercent) {
        shouldExit = true;
        reason = 'stop-loss';
      } else if (ret >= config.takeProfitPercent) {
        shouldExit = true;
        reason = 'take-profit';
      } else if (holdDays >= config.maxHoldDays) {
        shouldExit = true;
        reason = 'max-hold';
      } else if (exitSignal(candles, i, position.entryIndex)) {
        shouldExit = true;
        reason = 'signal';
      }

      if (shouldExit) {
        const proceeds = position.shares * bar.close;
        const cost = position.shares * position.entryPrice;
        cash += proceeds;
        trades.push({
          entryDate: candles[position.entryIndex].date,
          exitDate: bar.date,
          entryPrice: position.entryPrice,
          exitPrice: bar.close,
          returnPercent: ((bar.close - position.entryPrice) / position.entryPrice) * 100,
          exitReason: reason,
        });
        position = null;
        cooldownUntil = i + 1;
      }
    }

    if (!position && i >= cooldownUntil && cash > 0 && entry(candles, i)) {
      const shares = Math.floor(cash / bar.close);
      if (shares > 0) {
        cash -= shares * bar.close;
        position = { entryIndex: i, entryPrice: bar.close, shares };
      }
    }

    const equity = position
      ? cash + position.shares * bar.close
      : cash;
    equityCurve.push({ date: bar.date, equity });
  }

  if (position) {
    const last = candles[candles.length - 1];
    cash += position.shares * last.close;
    trades.push({
      entryDate: candles[position.entryIndex].date,
      exitDate: last.date,
      entryPrice: position.entryPrice,
      exitPrice: last.close,
      returnPercent: ((last.close - position.entryPrice) / position.entryPrice) * 100,
      exitReason: 'max-hold',
    });
    equityCurve[equityCurve.length - 1] = { date: last.date, equity: cash };
  }

  const startEquity = config.initialCapital;
  const endEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].equity : startEquity;
  const totalReturnPercent = ((endEquity - startEquity) / startEquity) * 100;

  const wins = trades.filter((t) => t.returnPercent > 0);
  const winRate = trades.length > 0 ? wins.length / trades.length : 0;
  const avgReturnPercent =
    trades.length > 0
      ? trades.reduce((s, t) => s + t.returnPercent, 0) / trades.length
      : 0;

  let peak = startEquity;
  let maxDrawdownPercent = 0;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
    if (dd > maxDrawdownPercent) maxDrawdownPercent = dd;
  }

  return {
    strategyId,
    totalReturnPercent,
    winRate,
    avgReturnPercent,
    maxDrawdownPercent,
    tradeCount: trades.length,
    equityCurve,
    trades,
  };
}
