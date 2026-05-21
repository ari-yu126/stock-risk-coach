import { SCALPING_STRATEGY_ORDER, STRATEGY_NAMES } from './entrySignalTypes';
import type {
  ConfidenceTrend,
  SignalPerformanceSnapshot,
  StrategyPerformanceSummary,
  SuccessRatePoint,
  TrackedSignal,
} from './signalTrackingTypes';
import { loadTrackedSignals } from './signalLogStore';

const RECENT_WINDOW = 10;
const PRIOR_WINDOW = 10;
const TREND_BUCKETS = 6;

function accuracyOf(records: TrackedSignal[]): number {
  const evaluated = records.filter((r) => r.status === 'evaluated' && r.evaluation);
  if (evaluated.length === 0) return 0;
  const wins = evaluated.filter((r) => r.evaluation!.success).length;
  return wins / evaluated.length;
}

function confidenceTrend(recent: number, prior: number): ConfidenceTrend {
  const diff = recent - prior;
  if (diff >= 0.08) return 'up';
  if (diff <= -0.08) return 'down';
  return 'flat';
}

function buildStrategySummaries(signals: TrackedSignal[]): StrategyPerformanceSummary[] {
  return SCALPING_STRATEGY_ORDER.map((strategyId) => {
    const subset = signals.filter((s) => s.strategyId === strategyId);
    const evaluated = subset.filter((s) => s.status === 'evaluated');
    const recent = evaluated.slice(-RECENT_WINDOW);
    const prior = evaluated.slice(-(RECENT_WINDOW + PRIOR_WINDOW), -RECENT_WINDOW);

    const accuracy = accuracyOf(evaluated);
    const recentAccuracy = accuracyOf(recent);
    const priorAccuracy = accuracyOf(prior);

    return {
      strategyId,
      strategyName: STRATEGY_NAMES[strategyId],
      accuracy,
      recentAccuracy,
      priorAccuracy,
      confidenceTrend: confidenceTrend(recentAccuracy, priorAccuracy),
      evaluatedCount: evaluated.length,
      pendingCount: subset.filter((s) => s.status === 'pending').length,
    };
  });
}

function buildSuccessRateTrend(signals: TrackedSignal[]): SuccessRatePoint[] {
  const evaluated = signals
    .filter((s) => s.status === 'evaluated' && s.evaluation)
    .sort((a, b) => a.evaluation!.evalDate.localeCompare(b.evaluation!.evalDate));

  if (evaluated.length === 0) return [];

  const bucketSize = Math.max(1, Math.ceil(evaluated.length / TREND_BUCKETS));
  const points: SuccessRatePoint[] = [];

  for (let i = 0; i < evaluated.length; i += bucketSize) {
    const chunk = evaluated.slice(i, i + bucketSize);
    const wins = chunk.filter((r) => r.evaluation!.success).length;
    const label = chunk[0].evaluation!.evalDate.slice(5);
    points.push({
      label,
      rate: wins / chunk.length,
      count: chunk.length,
    });
  }

  return points.slice(-TREND_BUCKETS);
}

/** SSR-safe empty snapshot (no localStorage). */
export function createEmptySignalPerformanceSnapshot(): SignalPerformanceSnapshot {
  return {
    strategies: buildStrategySummaries([]),
    overallRecentAccuracy: 0,
    overallPriorAccuracy: 0,
    overallConfidenceTrend: 'flat',
    recentResults: [],
    successRateTrend: [],
    pendingCount: 0,
    evaluatedCount: 0,
  };
}

export function getSignalPerformanceSnapshot(): SignalPerformanceSnapshot {
  const signals = loadTrackedSignals();
  const evaluated = signals.filter((s) => s.status === 'evaluated');
  const recentAll = evaluated.slice(-RECENT_WINDOW);
  const priorAll = evaluated.slice(-(RECENT_WINDOW + PRIOR_WINDOW), -RECENT_WINDOW);

  const overallRecentAccuracy = accuracyOf(recentAll);
  const overallPriorAccuracy = accuracyOf(priorAll);

  const recentResults = [...evaluated]
    .sort((a, b) => b.evaluation!.evaluatedAt.localeCompare(a.evaluation!.evaluatedAt))
    .slice(0, 12);

  return {
    strategies: buildStrategySummaries(signals),
    overallRecentAccuracy,
    overallPriorAccuracy,
    overallConfidenceTrend: confidenceTrend(overallRecentAccuracy, overallPriorAccuracy),
    recentResults,
    successRateTrend: buildSuccessRateTrend(signals),
    pendingCount: signals.filter((s) => s.status === 'pending').length,
    evaluatedCount: evaluated.length,
  };
}
