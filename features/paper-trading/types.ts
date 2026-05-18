import type { RiskLevel } from '../watchlist/types';
import type { PriceSource } from '../market-data/types';

export type TradeStatus = 'OPEN' | 'CLOSED' | 'STOPPED' | 'EXPIRED';
export type TradeExitReason = 'TAKE_PROFIT' | 'STOP_LOSS' | 'EXPIRED' | 'MANUAL';

export interface TradeConfig {
  initialCash: number;           // 가상 시작 현금 (원)
  positionSizeKRW: number;       // 1회 포지션 금액 (원)
  stopLossPercent: number;       // e.g. 0.05 = 5%
  takeProfitPercent: number;     // e.g. 0.10 = 10%
  maxHoldingMs: number;          // 최대 보유 시간 (ms)
  autoOpen: boolean;             // '오늘 관심 후보' 자동 매수
}

export interface Trade {
  id: string;                    // `${ticker}-${openTime}`
  ticker: string;
  name: string;
  sector: string;
  theme: string;
  riskLevel: RiskLevel;
  judgmentLabel: string;
  candidateScore: number;        // flowTotal at open time

  openTime: number;              // ms since epoch
  openPrice: number;             // 원 (from MarketStock.price)
  openPriceSource: PriceSource;
  shares: number;
  positionValueKRW: number;      // shares × openPrice

  stopLossPrice: number;
  takeProfitPrice: number;
  expiresAt: number;             // ms since epoch

  status: TradeStatus;
  closeTime?: number;
  closePrice?: number;
  exitReason?: TradeExitReason;
  returnPercent?: number;        // (closePrice − openPrice) / openPrice × 100
  returnKRW?: number;            // (closePrice − openPrice) × shares
  holdingDurationMs?: number;

  isMockData: boolean;           // priceSource === 'mock' → excluded from metrics
  currentPrice?: number;         // updated on each poll (open trades only)
}

export interface Portfolio {
  cash: number;
  config: TradeConfig;
  lastUpdatedAt: number;
}

export interface PortfolioSnapshot {
  portfolio: Portfolio;
  openTrades: Trade[];
  closedTrades: Trade[];
  totalEquity: number;           // cash + open positions market value
  unrealizedPnLKRW: number;
  realizedPnLKRW: number;        // real-data trades only
  mockRealizedPnLKRW: number;    // mock-data trades (informational)
}

export interface ThemePerf {
  trades: number;
  wins: number;
  avgReturnPercent: number;
}

export interface RiskLevelPerf {
  trades: number;
  wins: number;
  avgReturnPercent: number;
}

export interface StrategyMetrics {
  totalTrades: number;
  realDataTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;               // 0–1
  avgReturnPercent: number;
  avgWinPercent: number;
  avgLossPercent: number;
  profitFactor: number;          // Infinity if no losses
  maxSingleLossPercent: number;
  avgHoldingDurationMs: number;
  byTheme: Record<string, ThemePerf>;
  byRiskLevel: Partial<Record<RiskLevel, RiskLevelPerf>>;
  dataQualityWarning: string | null;
}
