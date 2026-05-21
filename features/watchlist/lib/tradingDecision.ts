import type { CommunityRiskLevel, CommunityStockItem } from '@/features/community-sentiment/types';
import type { EntrySignalResult } from './entrySignalTypes';
import type { RiskScore } from '../types';

export interface TradingDecision {
  entryScore: number;
  fomoLevel: CommunityRiskLevel;
  actionLabel: string;
}

function technicalScore(signals: EntrySignalResult[]): number {
  if (signals.length === 0) return 45;
  let rsi = 0;
  let volume = 0;
  let maTrend = 0;
  let volatility = 0;
  for (const s of signals) {
    rsi = Math.max(rsi, s.components.rsi);
    volume = Math.max(volume, s.components.volume);
    maTrend = Math.max(maTrend, s.components.maTrend);
    volatility = Math.max(volatility, s.components.volatility);
  }
  return Math.round(rsi * 0.3 + volume * 0.3 + maTrend * 0.25 + volatility * 0.15);
}

function communityMomentum(item: CommunityStockItem): number {
  const mention = Math.min(100, Math.max(0, item.mentionGrowthPercent));
  return Math.round(item.sentimentScore * 0.45 + mention * 0.35 + item.trendKeywordScore * 0.2);
}

function resolveFomo(
  community: CommunityStockItem | null,
  risk: RiskScore,
  signals: EntrySignalResult[],
): { penalty: number; level: CommunityRiskLevel } {
  let level: CommunityRiskLevel = 'LOW';
  let penalty = 0;

  if (community?.fomoHigh || community?.overheatWarning) {
    level = 'HIGH';
    penalty = 28;
  } else if (community?.riskLevel === 'HIGH') {
    level = 'HIGH';
    penalty = 22;
  } else if (community?.riskLevel === 'MEDIUM') {
    level = 'MEDIUM';
    penalty = 12;
  }

  if (signals.some((s) => s.isOverheated)) {
    level = level === 'LOW' ? 'MEDIUM' : 'HIGH';
    penalty = Math.max(penalty, 18);
  }
  if (risk.level === '위험') {
    level = 'HIGH';
    penalty = Math.max(penalty, 20);
  } else if (risk.level === '높음' && level === 'LOW') {
    level = 'MEDIUM';
    penalty = Math.max(penalty, 10);
  }

  return { penalty, level };
}

function actionLabel(
  score: number,
  signals: EntrySignalResult[],
  community: CommunityStockItem | null,
  risk: RiskScore,
  fomo: CommunityRiskLevel,
): string {
  const anyEnter = signals.some((s) => s.canEnter);
  const anyApproaching = signals.some((s) => s.isApproaching);
  const overheat =
    signals.some((s) => s.isOverheated) || community?.fomoHigh || community?.overheatWarning;

  if (risk.level === '위험' || (fomo === 'HIGH' && score < 70)) return '추격매수 주의';
  if (overheat && score >= 55) return '추격매수 주의';
  if (score >= 75 && anyEnter) return '분할진입 가능';
  if (score >= 55 && anyApproaching) return '눌림 대기';
  if (score < 40) return '관망';
  if (anyEnter) return '분할진입 가능';
  return '관망';
}

/** Entry score + FOMO level for watchlist card */
export function buildTradingDecision(
  signals: EntrySignalResult[],
  risk: RiskScore,
  community?: CommunityStockItem | null,
): TradingDecision {
  const technical = technicalScore(signals);
  const comm = community ? communityMomentum(community) : null;
  const { penalty, level } = resolveFomo(community ?? null, risk, signals);

  const entryScore = Math.min(
    100,
    Math.max(
      0,
      comm != null
        ? Math.round(technical * 0.82 + comm * 0.18 - penalty)
        : Math.round(technical * 0.92 - penalty * 0.5),
    ),
  );

  return {
    entryScore,
    fomoLevel: level,
    actionLabel: actionLabel(entryScore, signals, community ?? null, risk, level),
  };
}
