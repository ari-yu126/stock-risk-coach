import { COMMUNITY_WEIGHTS, SCORE_WEIGHTS, TREND_KEYWORD_POINTS } from './config';
import type {
  CommunityPost,
  CommunityRiskLevel,
  CommunitySource,
  HourlySnapshot,
} from '../types';

export function calcTrendKeywordScore(trendHits: string[]): number {
  const unique = [...new Set(trendHits)];
  const raw = unique.reduce((s, kw) => s + (TREND_KEYWORD_POINTS[kw] ?? 5), 0);
  return Math.min(100, raw);
}

/**
 * Per-post: assign all comments on that post to positive / negative / neutral bucket.
 * Ensures positive + negative + neutral = 1 (never exceeds 100% in UI).
 */
export function calcCommentSentimentRatios(posts: CommunityPost[]): {
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  positiveComments: number;
  negativeComments: number;
  neutralComments: number;
  totalComments: number;
} {
  let positiveComments = 0;
  let negativeComments = 0;
  let neutralComments = 0;

  for (const p of posts) {
    if (p.positiveHits > p.negativeHits) positiveComments += p.commentCount;
    else if (p.negativeHits > p.positiveHits) negativeComments += p.commentCount;
    else neutralComments += p.commentCount;
  }

  const totalComments = positiveComments + negativeComments + neutralComments;
  if (totalComments === 0) {
    return {
      positiveRatio: 0.5,
      negativeRatio: 0.2,
      neutralRatio: 0.3,
      positiveComments: 0,
      negativeComments: 0,
      neutralComments: 0,
      totalComments: 0,
    };
  }

  return {
    positiveRatio: positiveComments / totalComments,
    negativeRatio: negativeComments / totalComments,
    neutralRatio: neutralComments / totalComments,
    positiveComments,
    negativeComments,
    neutralComments,
    totalComments,
  };
}

/** Sentiment = weighted positive comment share × 100 across sources */
export function calcWeightedSentimentScore(
  posts: CommunityPost[],
  bySource: Map<CommunitySource, CommunityPost[]>,
): number {
  let weighted = 0;
  let weightSum = 0;

  for (const [source, list] of bySource) {
    const w = COMMUNITY_WEIGHTS[source];
    if (list.length === 0) continue;
    const { positiveRatio, totalComments } = calcCommentSentimentRatios(list);
    const score = totalComments > 0 ? positiveRatio * 100 : 50;
    weighted += score * w;
    weightSum += w;
  }

  if (weightSum === 0) {
    const { positiveRatio, totalComments } = calcCommentSentimentRatios(posts);
    return totalComments > 0 ? Math.round(positiveRatio * 100) : 50;
  }

  return Math.round(weighted / weightSum);
}

export function normalizeGrowthRatio(ratio: number): number {
  if (ratio <= 0) return 0;
  return Math.min(100, Math.round((ratio - 1) * 50 + 50));
}

export function calcCommunityScore(parts: {
  sentimentScore: number;
  mentionGrowth: number;
  volumeGrowth: number;
  trendKeywordScore: number;
}): number {
  const mg = normalizeGrowthRatio(parts.mentionGrowth);
  const vg = normalizeGrowthRatio(parts.volumeGrowth);
  const raw =
    parts.sentimentScore * SCORE_WEIGHTS.sentiment +
    mg * SCORE_WEIGHTS.mentionGrowth +
    vg * SCORE_WEIGHTS.volumeGrowth +
    parts.trendKeywordScore * SCORE_WEIGHTS.trendKeyword;
  return Math.round(Math.min(100, Math.max(0, raw)));
}

export function calcRiskLevel(input: {
  mentionGrowth: number;
  negativeRatio: number;
  volumeGrowth: number;
  priceChangePercent: number;
  hourly: HourlySnapshot[];
  mentionCount: number;
}): CommunityRiskLevel {
  const { mentionGrowth, negativeRatio, volumeGrowth, priceChangePercent, hourly } = input;

  let riskPoints = 0;
  if (mentionGrowth >= 2.5) riskPoints += 2;
  if (negativeRatio >= 0.45) riskPoints += 2;
  if (volumeGrowth >= 3 && priceChangePercent < -1) riskPoints += 2;
  if (volumeGrowth >= 4) riskPoints += 1;

  if (hourly.length >= 4) {
    const recent = hourly.slice(-4);
    const volPeak = Math.max(...recent.map((h) => h.volumeRatio));
    const lastVol = recent[recent.length - 1].volumeRatio;
    const lastSent = recent[recent.length - 1].sentimentScore;
    const prevSent = recent[0].sentimentScore;
    if (volPeak >= 3 && lastVol < volPeak * 0.6 && priceChangePercent < 0) riskPoints += 2;
    if (lastSent < prevSent - 15 && negativeRatio > 0.35) riskPoints += 1;
  }

  if (riskPoints >= 4) return 'HIGH';
  if (riskPoints >= 2) return 'MEDIUM';
  return 'LOW';
}

export function buildAiSummary(trendKeywords: string[], sentimentScore: number, mentionGrowth: number): string {
  const theme = trendKeywords.slice(0, 2).join('·') || '테마';
  const mood =
    sentimentScore >= 60 ? '긍정 반응 상승' : sentimentScore <= 40 ? '부정 우려 확대' : '의견 혼재';
  const mention =
    mentionGrowth >= 1.8 ? '언급 급증' : mentionGrowth >= 1.2 ? '언급 증가' : '언급 보합';
  return `${theme} 관련 ${mention}으로 ${mood}`;
}
