export type MarketType = 'KOSPI' | 'KOSDAQ';
export type PriceSource = 'naver-finance-primary' | 'naver-finance-polling' | 'mock';

export interface MarketStock {
  ticker: string;
  name: string;
  sector: string;
  price: number;           // 원
  changePercent: number;   // % (signed)
  volume: number;          // 주
  avgVolume: number;       // 주, 20일 평균
  marketCapBillion: number; // 십억원 (billion KRW) — same scale as watchlist Stock
  tradingValue: number;    // 억원, price × volume ÷ 100,000,000
  marketType: MarketType;
  priceSource: PriceSource;
}
