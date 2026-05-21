export type CommunitySource = 'naver-jongto' | 'dc-stock' | 'fmkorea-stock';

export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export type CommunityRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CommunityPost {
  id: string;
  source: CommunitySource;
  ticker: string;
  title: string;
  commentCount: number;
  positiveHits: number;
  negativeHits: number;
  trendHits: string[];
  sentiment: SentimentLabel;
  /** 0–100 normalized positive share for this post */
  sentimentScore: number;
  publishedAt: string;
}

export interface HourlySnapshot {
  hour: string;
  mentionCount: number;
  sentimentScore: number;
  volumeRatio: number;
}

export interface CommunityStockItem {
  ticker: string;
  name: string;
  sector: string;
  communityScore: number;
  sentimentScore: number;
  mentionGrowth: number;
  volumeGrowth: number;
  trendKeywordScore: number;
  mentionCount: number;
  mentionGrowthPercent: number;
  positiveRatio: number;
  negativeRatio: number;
  neutralRatio: number;
  volumeGrowthPercent: number;
  trendKeywords: string[];
  riskLevel: CommunityRiskLevel;
  changeDirection: 'up' | 'down' | 'flat';
  hourOverHourChange: number;
  fomoHigh: boolean;
  overheatWarning: boolean;
  aiSummary: string;
  hourly: HourlySnapshot[];
  priceChangePercent: number;
}

export interface CommunitySentimentResponse {
  items: CommunityStockItem[];
  collectedAt: string;
  providerType: 'mock' | 'live';
  nextCollectAt: string;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}

/** Pluggable analyzer — swap for LLM later */
export interface SentimentAnalyzer {
  analyze(text: string): {
    sentiment: SentimentLabel;
    positiveHits: number;
    negativeHits: number;
    trendHits: string[];
    score: number;
  };
}
