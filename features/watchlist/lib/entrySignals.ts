import type { Candle } from '@/features/paper-trading/lib/candles/types';
import { highestClose, rsi, sma, volumes } from '@/features/paper-trading/lib/backtest/indicators';
import type {
  EntrySignalComponents,
  EntrySignalResult,
  EntrySignalStage,
  ScalpingStrategyId,
} from './entrySignalTypes';
import { SCALPING_STRATEGY_ORDER, STRATEGY_NAMES } from './entrySignalTypes';

export interface StockSnapshot {
  ticker: string;
  name: string;
  changePercent: number;
  volume: number;
  avgVolume: number;
}

const STRATEGIES = SCALPING_STRATEGY_ORDER;

function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, n));
}

function volumeRatio(stock: StockSnapshot, candles: Candle[], i: number): number {
  const vols = volumes(candles);
  const avg = sma(vols, 20, i);
  const fromCandle = avg && avg > 0 ? candles[i].volume / avg : 1;
  const fromQuote = stock.avgVolume > 0 ? stock.volume / stock.avgVolume : 1;
  return (fromCandle + fromQuote) / 2;
}

function computeComponents(
  candles: Candle[],
  i: number,
  stock: StockSnapshot,
): EntrySignalComponents & { rsiVal: number | null; volRatio: number; sma20: number | null; sma50: number | null } {
  const closesArr = closes(candles);
  const rsiVal = rsi(candles, 14, i);
  const volRatio = volumeRatio(stock, candles, i);
  const sma20 = sma(closesArr, 20, i);
  const sma50 = sma(closesArr, 50, i);

  const rsiScore =
    rsiVal == null
      ? 40
      : rsiVal < 30
        ? 90
        : rsiVal < 40
          ? 75
          : rsiVal < 50
            ? 55
            : rsiVal > 65
              ? 25
              : 45;

  const volumeScore = clamp((volRatio - 0.7) * 45);

  let maTrendScore = 50;
  if (sma20 != null && sma50 != null) {
    const spread = ((sma20 - sma50) / sma50) * 100;
    maTrendScore = clamp(50 + spread * 25);
  }

  const absChg = Math.abs(stock.changePercent);
  const volatilityScore =
    absChg >= 7 ? 20 : absChg >= 4 ? 55 : absChg >= 1 ? 80 : 45;

  return {
    rsi: Math.round(rsiScore),
    volume: Math.round(volumeScore),
    maTrend: Math.round(maTrendScore),
    volatility: Math.round(volatilityScore),
    rsiVal,
    volRatio,
    sma20,
    sma50,
  };
}

function scoreFromComponents(c: EntrySignalComponents, weights: EntrySignalComponents): number {
  const wSum = weights.rsi + weights.volume + weights.maTrend + weights.volatility;
  const raw =
    (c.rsi * weights.rsi +
      c.volume * weights.volume +
      c.maTrend * weights.maTrend +
      c.volatility * weights.volatility) /
    wSum;
  return Math.round(clamp(raw));
}

function evalRsiRebound(
  candles: Candle[],
  i: number,
  stock: StockSnapshot,
  comp: ReturnType<typeof computeComponents>,
): Omit<EntrySignalResult, 'ticker' | 'name' | 'strategyId' | 'strategyName'> {
  const prev = i > 0 ? comp.rsiVal != null ? rsi(candles, 14, i - 1) : null : null;
  const curr = comp.rsiVal;

  const canEnter =
    prev != null &&
    curr != null &&
    prev < 40 &&
    curr > prev &&
    curr >= 38;

  const isApproaching =
    !canEnter &&
    curr != null &&
    ((curr < 42 && curr > (prev ?? curr)) || (prev != null && prev < 45 && curr >= 36));

  const isOverheated =
    (curr != null && curr > 62) ||
    (comp.volRatio >= 3.5 && stock.changePercent > 5);

  let stage: EntrySignalStage = 'wait';
  if (isOverheated) stage = 'overheated';
  else if (canEnter) stage = 'entry-ready';
  else if (isApproaching) stage = 'approaching';

  const entryScore = scoreFromComponents(comp, {
    rsi: 45,
    volume: 25,
    maTrend: 20,
    volatility: 10,
  });

  const summary = buildSummary('rsi-rebound', stage, comp, stock, curr);

  return {
    entryScore,
    stage,
    canEnter,
    isApproaching,
    isOverheated,
    components: { rsi: comp.rsi, volume: comp.volume, maTrend: comp.maTrend, volatility: comp.volatility },
    summary,
  };
}

function evalVolumeBreakout(
  candles: Candle[],
  i: number,
  stock: StockSnapshot,
  comp: ReturnType<typeof computeComponents>,
): Omit<EntrySignalResult, 'ticker' | 'name' | 'strategyId' | 'strategyName'> {
  const high10 = highestClose(candles, 10, i - 1);
  const c = candles[i];
  const canEnter = high10 != null && comp.volRatio >= 1.25 && c.close > high10;
  const isApproaching =
    !canEnter && comp.volRatio >= 1.05 && high10 != null && c.close >= high10 * 0.985;
  const isOverheated = comp.volRatio >= 4 || stock.changePercent > 7;

  let stage: EntrySignalStage = 'wait';
  if (isOverheated) stage = 'overheated';
  else if (canEnter) stage = 'entry-ready';
  else if (isApproaching) stage = 'approaching';

  const entryScore = scoreFromComponents(comp, {
    rsi: 15,
    volume: 45,
    maTrend: 25,
    volatility: 15,
  });

  return {
    entryScore,
    stage,
    canEnter,
    isApproaching,
    isOverheated,
    components: { rsi: comp.rsi, volume: comp.volume, maTrend: comp.maTrend, volatility: comp.volatility },
    summary: buildSummary('volume-breakout', stage, comp, stock, comp.rsiVal),
  };
}

function evalPullback(
  candles: Candle[],
  i: number,
  stock: StockSnapshot,
  comp: ReturnType<typeof computeComponents>,
): Omit<EntrySignalResult, 'ticker' | 'name' | 'strategyId' | 'strategyName'> {
  const c = candles[i];
  const uptrend = comp.sma20 != null && comp.sma50 != null && comp.sma20 > comp.sma50;
  const nearMa = comp.sma20 != null && c.low <= comp.sma20 * 1.03;
  const bullish = c.close > c.open && comp.sma20 != null && c.close > comp.sma20;

  const canEnter = uptrend && nearMa && bullish;
  const isApproaching = uptrend && nearMa && !bullish;
  const isOverheated =
    (comp.volRatio >= 3.5 && stock.changePercent > 6) ||
    (comp.sma20 != null && c.close < comp.sma20 * 0.97 && stock.changePercent < -2);

  let stage: EntrySignalStage = 'wait';
  if (isOverheated) stage = 'overheated';
  else if (canEnter) stage = 'entry-ready';
  else if (isApproaching) stage = 'approaching';

  const entryScore = scoreFromComponents(comp, {
    rsi: 20,
    volume: 25,
    maTrend: 40,
    volatility: 15,
  });

  return {
    entryScore,
    stage,
    canEnter,
    isApproaching,
    isOverheated,
    components: { rsi: comp.rsi, volume: comp.volume, maTrend: comp.maTrend, volatility: comp.volatility },
    summary: buildSummary('pullback', stage, comp, stock, comp.rsiVal),
  };
}

function buildSummary(
  strategy: ScalpingStrategyId,
  stage: EntrySignalStage,
  comp: ReturnType<typeof computeComponents>,
  stock: StockSnapshot,
  rsiVal: number | null,
): string {
  const vol = comp.volRatio.toFixed(1);
  if (stage === 'overheated') {
    return `거래량 ${vol}배·변동 ${stock.changePercent.toFixed(1)}%로 단기 과열 — 진입보다 관망 권장`;
  }
  if (stage === 'entry-ready') {
    if (strategy === 'rsi-rebound') return `RSI ${rsiVal?.toFixed(0) ?? '-'} 반등 확인 — 단기 진입 조건 충족`;
    if (strategy === 'volume-breakout') return `거래량 ${vol}배 + 고점 돌파 — 돌파 진입 조건 충족`;
    return `상승 추세 눌림 후 양봉 — 눌림목 진입 조건 충족`;
  }
  if (stage === 'approaching') {
    if (strategy === 'rsi-rebound') return `RSI ${rsiVal?.toFixed(0) ?? '-'} 구간 회복 중 — 조건 근접`;
    if (strategy === 'volume-breakout') return `거래량 ${vol}배로 확대 — 고점 돌파 임박`;
    return `20일선 근처 조정 — 반등 캔들 대기`;
  }
  return `조건 미충족 — 추세·거래량 재확인 후 대기`;
}

const EVALUATORS = {
  'rsi-rebound': evalRsiRebound,
  'volume-breakout': evalVolumeBreakout,
  pullback: evalPullback,
} as const;

export function evaluateEntrySignals(
  candles: Candle[],
  stock: StockSnapshot,
): EntrySignalResult[] {
  if (candles.length < 55) return [];

  const i = candles.length - 1;
  const comp = computeComponents(candles, i, stock);

  return STRATEGIES.map((strategyId) => {
    const evaluated = EVALUATORS[strategyId](candles, i, stock, comp);
    return {
      ticker: stock.ticker,
      name: stock.name,
      strategyId,
      strategyName: STRATEGY_NAMES[strategyId],
      ...evaluated,
    };
  });
}
