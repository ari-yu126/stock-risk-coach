import type { TradeConfig } from '../types';

export const DEFAULT_TRADE_CONFIG: TradeConfig = {
  initialCash:      10_000_000,         // 1,000만원
  positionSizeKRW:   1_000_000,         // 100만원 per position
  stopLossPercent:        0.05,         // 5%
  takeProfitPercent:      0.10,         // 10%
  maxHoldingMs: 6 * 60 * 60 * 1000,    // 6시간
  autoOpen: true,
};
