import type { EntrySignalStage, ScalpingStrategyId } from './entrySignalTypes';

export type SignalLogStatus = 'pending' | 'evaluated' | 'expired';

export interface SignalEvaluation {
  evalDate: string;
  closePrice: number;
  returnPercent: number;
  maxUpsidePercent: number;
  maxDownsidePercent: number;
  hitTakeProfit: boolean;
  hitStopLoss: boolean;
  success: boolean;
  evaluatedAt: string;
}

export interface TrackedSignal {
  id: string;
  dedupeKey: string;
  ticker: string;
  name: string;
  strategyId: ScalpingStrategyId;
  strategyName: string;
  stage: EntrySignalStage;
  entryScore: number;
  entryPrice: number;
  signalAt: string;
  signalDate: string;
  status: SignalLogStatus;
  evaluation?: SignalEvaluation;
}

export type ConfidenceTrend = 'up' | 'down' | 'flat';

export interface StrategyPerformanceSummary {
  strategyId: ScalpingStrategyId;
  strategyName: string;
  accuracy: number;
  recentAccuracy: number;
  priorAccuracy: number;
  confidenceTrend: ConfidenceTrend;
  evaluatedCount: number;
  pendingCount: number;
}

export interface SuccessRatePoint {
  label: string;
  rate: number;
  count: number;
}

export interface SignalPerformanceSnapshot {
  strategies: StrategyPerformanceSummary[];
  overallRecentAccuracy: number;
  overallPriorAccuracy: number;
  overallConfidenceTrend: ConfidenceTrend;
  recentResults: TrackedSignal[];
  successRateTrend: SuccessRatePoint[];
  pendingCount: number;
  evaluatedCount: number;
}
