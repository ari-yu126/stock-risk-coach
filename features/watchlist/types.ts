export type RiskLevel = '낮음' | '보통' | '높음' | '위험';
export type AttentionLevel = '관찰중' | '주의' | '경계' | '위험신호';

export interface Stock {
  ticker: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCapBillion: number;
  sector: string;
  priceSource?: string; // 'naver-finance-primary' | 'naver-finance-polling' | 'mock'
}

export interface PriceRange {
  low: number;
  high: number;
}

export interface RiskScore {
  score: number;
  level: RiskLevel;
  reasons: string[];
  attentionLevel: AttentionLevel;
  attentionReason: string;
  estimatedTakeProfitRange: PriceRange;
  estimatedStopLossLevel: number;
}

export interface WatchlistItem {
  stock: Stock;
  riskScore: RiskScore;
}
