import type { StockCandidate } from './candidateDiscovery';

export type MarketMoodType =
  | 'risk-on'
  | 'risk-off'
  | 'mixed'
  | 'momentum-speculative';

export interface MarketMood {
  mood: MarketMoodType;
  summary: string;
  confidence: number; // 0–1
}

export function analyzeMarketMood(candidates: StockCandidate[]): MarketMood {
  if (candidates.length === 0) {
    return { mood: 'mixed', summary: '분석할 후보 종목이 없습니다', confidence: 0 };
  }

  const advancing = candidates.filter((c) => c.stock.changePercent > 0).length;
  const declining  = candidates.filter((c) => c.stock.changePercent < 0).length;
  const avgChange  = candidates.reduce((s, c) => s + c.stock.changePercent, 0) / candidates.length;
  const positiveThemes = candidates.filter((c) => c.matchedTheme.sentimentSummary === 'positive').length;
  const highSurge = candidates.filter((c) => c.scoreBreakdown.volumeRatio >= 3).length;

  const advancingRatio     = advancing / candidates.length;
  const positiveThemeRatio = positiveThemes / candidates.length;

  let mood: MarketMoodType;
  let confidence: number;

  if (highSurge >= 2 && positiveThemeRatio >= 0.5) {
    mood = 'momentum-speculative';
    confidence = Math.min(0.6 + (highSurge / candidates.length) * 0.35, 0.95);
  } else if (advancingRatio >= 0.6 && avgChange > 1 && positiveThemeRatio >= 0.5) {
    mood = 'risk-on';
    confidence = 0.5 + Math.min((advancingRatio - 0.6) * 2, 0.4);
  } else if (advancingRatio <= 0.4 && avgChange < -0.5) {
    mood = 'risk-off';
    confidence = 0.5 + Math.min((0.4 - advancingRatio) * 2, 0.4);
  } else {
    mood = 'mixed';
    confidence = 0.4;
  }

  const topThemeNames = [...new Set(candidates.map((c) => c.matchedTheme.name))].slice(0, 2);

  const summary = buildSummary(mood, { topThemeNames, advancing, declining, candidates, avgChange, highSurge });

  return { mood, summary, confidence };
}

function buildSummary(
  mood: MarketMoodType,
  ctx: {
    topThemeNames: string[];
    advancing: number;
    declining: number;
    candidates: StockCandidate[];
    avgChange: number;
    highSurge: number;
  },
): string {
  const sign = ctx.avgChange >= 0 ? '+' : '';

  switch (mood) {
    case 'risk-on':
      return `${ctx.topThemeNames.join('·')} 중심 위험선호 강화 (${sign}${ctx.avgChange.toFixed(1)}%)`;
    case 'risk-off':
      return `하락 종목 우세 (${ctx.declining}/${ctx.candidates.length}종목) — 관망 심리 (${sign}${ctx.avgChange.toFixed(1)}%)`;
    case 'momentum-speculative':
      return `${ctx.topThemeNames.join('·')} 테마 과열 가능성 — ${ctx.highSurge}종목 거래량 급증`;
    case 'mixed':
      return `상승·하락 종목 혼재 (${ctx.advancing}↑ ${ctx.declining}↓) — 관망 심리`;
  }
}
