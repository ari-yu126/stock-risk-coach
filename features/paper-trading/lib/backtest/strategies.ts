import type { Candle } from '../candles/types';
import type { EntrySignalFn, ExitSignalFn, StrategyId, StrategyMeta } from './types';
import { highestClose, rsi, sma, volumes } from './indicators';

export const STRATEGY_CATALOG: StrategyMeta[] = [
  {
    id: 'volume-breakout',
    name: '거래량 돌파',
    shortDescription: '거래량이 평균을 크게 넘고 가격이 최근 고점을 돌파할 때 진입합니다.',
    formulaLines: [
      '진입: 거래량 > 20일 평균 × 1.25',
      '      AND 종가 > 최근 10일 고점 돌파',
      '청산: 손절 −5% / 익절 +8% / 최대 8거래일 보유',
    ],
  },
  {
    id: 'rsi-rebound',
    name: 'RSI 반등',
    shortDescription: 'RSI가 과매도 구간에서 반등할 때 단기 매수합니다.',
    formulaLines: [
      '진입: 전일 RSI(14) < 40 AND 당일 RSI 반등 AND RSI ≥ 38',
      '청산: RSI > 62 또는 손절/익절/최대 8거래일',
    ],
  },
  {
    id: 'pullback',
    name: '눌림목',
    shortDescription: '상승 추세 중 단기 조정(눌림) 후 반등 캔들에서 진입합니다.',
    formulaLines: [
      '진입: SMA(20) > SMA(50) (상승 추세)',
      '      AND 저가 ≤ SMA(20) × 1.03 (눌림)',
      '      AND 양봉 AND 종가 > SMA(20)',
      '청산: 종가 < SMA(20) 또는 손절/익절/최대 8거래일',
    ],
  },
];

const VOL_PERIOD = 20;
const BREAKOUT_PERIOD = 10;
const RSI_PERIOD = 14;
const PULLBACK_SLOW_MA = 50;

export const entrySignals: Record<StrategyId, EntrySignalFn> = {
  'volume-breakout': (candles, i) => {
    const vols = volumes(candles);
    const avgVol = sma(vols, VOL_PERIOD, i);
    const highClose = highestClose(candles, BREAKOUT_PERIOD, i - 1);
    if (avgVol == null || highClose == null || i < 1) return false;
    const c = candles[i];
    return c.volume > avgVol * 1.25 && c.close > highClose;
  },

  'rsi-rebound': (candles, i) => {
    if (i < 1) return false;
    const prev = rsi(candles, RSI_PERIOD, i - 1);
    const curr = rsi(candles, RSI_PERIOD, i);
    if (prev == null || curr == null) return false;
    return prev < 40 && curr > prev && curr >= 38;
  },

  pullback: (candles, i) => {
    const closesArr = candles.map((c) => c.close);
    const sma20 = sma(closesArr, 20, i);
    const smaSlow = sma(closesArr, PULLBACK_SLOW_MA, i);
    if (sma20 == null || smaSlow == null) return false;
    const c = candles[i];
    return (
      sma20 > smaSlow &&
      c.low <= sma20 * 1.03 &&
      c.close > c.open &&
      c.close > sma20
    );
  },
};

export const exitSignals: Record<StrategyId, ExitSignalFn> = {
  'volume-breakout': () => false,

  'rsi-rebound': (candles, i) => {
    const curr = rsi(candles, RSI_PERIOD, i);
    return curr != null && curr > 62;
  },

  pullback: (candles, i) => {
    const closesArr = candles.map((c) => c.close);
    const sma20 = sma(closesArr, 20, i);
    if (sma20 == null) return false;
    return candles[i].close < sma20;
  },
};

export function getStrategyMeta(id: StrategyId): StrategyMeta {
  return STRATEGY_CATALOG.find((s) => s.id === id)!;
}
