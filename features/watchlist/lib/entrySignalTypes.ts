export type ScalpingStrategyId = 'rsi-rebound' | 'volume-breakout' | 'pullback';

/** Display/evaluation order — matches backtest STRATEGY_CATALOG */
export const SCALPING_STRATEGY_ORDER: ScalpingStrategyId[] = [
  'volume-breakout',
  'rsi-rebound',
  'pullback',
];

export type EntrySignalStage = 'wait' | 'approaching' | 'entry-ready' | 'overheated';

export interface EntrySignalComponents {
  rsi: number;
  volume: number;
  maTrend: number;
  volatility: number;
}

export interface EntrySignalResult {
  ticker: string;
  name: string;
  strategyId: ScalpingStrategyId;
  strategyName: string;
  entryScore: number;
  stage: EntrySignalStage;
  canEnter: boolean;
  isApproaching: boolean;
  isOverheated: boolean;
  components: EntrySignalComponents;
  summary: string;
}

export interface EntrySignalsResponse {
  signals: EntrySignalResult[];
  fetchedAt: string;
  candleSource: 'naver-fchart' | 'synthetic';
}

export const STAGE_LABEL: Record<EntrySignalStage, string> = {
  wait: '대기',
  approaching: '접근중',
  'entry-ready': '진입 가능',
  overheated: '과열',
};

export const STRATEGY_NAMES: Record<ScalpingStrategyId, string> = {
  'rsi-rebound': 'RSI 반등',
  'volume-breakout': '거래량 돌파',
  pullback: '눌림목',
};
