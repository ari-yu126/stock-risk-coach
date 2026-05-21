import type { Candle } from '../candles/types';

export type StrategyId = 'volume-breakout' | 'rsi-rebound' | 'pullback';

export interface StrategyMeta {
  id: StrategyId;
  name: string;
  shortDescription: string;
  formulaLines: string[];
}

export interface BacktestTrade {
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  returnPercent: number;
  exitReason: 'take-profit' | 'stop-loss' | 'signal' | 'max-hold';
}

export interface EquityPoint {
  date: string;
  equity: number;
}

export interface BacktestResult {
  strategyId: StrategyId;
  totalReturnPercent: number;
  winRate: number;
  avgReturnPercent: number;
  maxDrawdownPercent: number;
  tradeCount: number;
  equityCurve: EquityPoint[];
  trades: BacktestTrade[];
}

export interface BacktestConfig {
  initialCapital: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  maxHoldDays: number;
}

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
  initialCapital: 10_000_000,
  stopLossPercent: 0.05,
  takeProfitPercent: 0.08,
  maxHoldDays: 8,
};

/** Minimum bars before first entry (per strategy indicator warmup). */
export const STRATEGY_WARMUP_BARS: Record<StrategyId, number> = {
  'volume-breakout': 22,
  'rsi-rebound': 16,
  pullback: 52,
};

export type EntrySignalFn = (candles: Candle[], i: number) => boolean;
export type ExitSignalFn = (candles: Candle[], i: number, entryIndex: number) => boolean;
