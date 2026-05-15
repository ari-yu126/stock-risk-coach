import type { MarketStock } from '../../types';

export interface MarketDataQuery {
  sector?: string;
  marketType?: 'KOSPI' | 'KOSDAQ';
  limit?: number;
}

export interface MarketDataProvider {
  fetchStocks(query?: MarketDataQuery): Promise<MarketStock[]>;
}

export type MarketDataProviderType = 'naver-finance' | 'mock';

export interface MarketDataResponse {
  stocks: MarketStock[];
  providerType: MarketDataProviderType;
  fetchedAt: string; // ISO 8601, server time
  fallbackReason: string | null; // null = primary provider used; string = why mock was served
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}
