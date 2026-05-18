export type SignalImpact = 'positive' | 'negative' | 'neutral';

export interface GlobalSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  sector: string;
  sectorLabel: string;
  relatedTickers: string[];
  impact: SignalImpact;
  publishedAt: string; // ISO 8601
}

export interface GlobalSignalsResponse {
  signals: GlobalSignal[];
  providerType: 'finnhub' | 'mock';
  fetchedAt: string;
  fallbackReason: string | null;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
}
