export type MarketSentiment = 'bullish' | 'bearish' | 'mixed';

export type RecommendationAction =
  | '오늘 관심 후보'
  | '조금 더 지켜보기'
  | '방향 애매함'
  | '지금 접근 위험';

export interface MarketBriefing {
  date: string;
  summary: string;
  keyThemes: string[];
  overallSentiment: MarketSentiment;
}
