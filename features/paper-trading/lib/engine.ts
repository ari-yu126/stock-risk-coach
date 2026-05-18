import type {
  Trade, Portfolio, TradeStatus, TradeExitReason,
  StrategyMetrics, ThemePerf, RiskLevelPerf, PortfolioSnapshot,
} from '../types';
import type { StockCandidate } from '@/features/market-news/lib/candidateDiscovery';
import type { MarketStock } from '@/features/market-data/types';
import type { RiskLevel } from '@/features/watchlist/types';

// ── Open ──────────────────────────────────────────────────────────────────────
// Returns a new Trade if all conditions are met, null otherwise.
// Entry price comes from the live MarketStock.price — never from sparklines.

export function tryOpenTrade(
  candidate: StockCandidate,
  currentStock: MarketStock,
  portfolio: Portfolio,
  openTrades: Trade[],
): Trade | null {
  if (!portfolio.config.autoOpen) return null;
  if (candidate.judgmentLabel !== '오늘 관심 후보') return null;

  const ticker = candidate.stock.ticker;
  if (openTrades.some((t) => t.ticker === ticker)) return null;

  const price = currentStock.price;
  if (price <= 0) return null;

  const shares = Math.floor(portfolio.config.positionSizeKRW / price);
  if (shares === 0) return null;

  const positionValueKRW = shares * price;
  if (portfolio.cash < positionValueKRW) return null;

  const now = Date.now();
  const sl = portfolio.config.stopLossPercent;
  const tp = portfolio.config.takeProfitPercent;

  return {
    id: `${ticker}-${now}`,
    ticker,
    name: candidate.stock.name,
    sector: candidate.stock.sector,
    theme: candidate.matchedTheme.name,
    riskLevel: candidate.riskScore.level,
    judgmentLabel: candidate.judgmentLabel,
    candidateScore: candidate.candidateScore,

    openTime: now,
    openPrice: price,
    openPriceSource: currentStock.priceSource,
    shares,
    positionValueKRW,

    stopLossPrice:   Math.round(price * (1 - sl)),
    takeProfitPrice: Math.round(price * (1 + tp)),
    expiresAt: now + portfolio.config.maxHoldingMs,

    status: 'OPEN',
    isMockData: currentStock.priceSource === 'mock',
    currentPrice: price,
  };
}

// ── Evaluate ──────────────────────────────────────────────────────────────────

export function evaluateTrade(
  trade: Trade,
  currentPrice: number,
  now: number = Date.now(),
): { shouldClose: boolean; reason: TradeExitReason | null } {
  if (trade.status !== 'OPEN') return { shouldClose: false, reason: null };

  if (currentPrice >= trade.takeProfitPrice) return { shouldClose: true, reason: 'TAKE_PROFIT' };
  if (currentPrice <= trade.stopLossPrice)   return { shouldClose: true, reason: 'STOP_LOSS' };
  if (now >= trade.expiresAt)               return { shouldClose: true, reason: 'EXPIRED' };
  return { shouldClose: false, reason: null };
}

// ── Close ─────────────────────────────────────────────────────────────────────

export function closeTrade(
  trade: Trade,
  closePrice: number,
  exitReason: TradeExitReason,
  now: number = Date.now(),
): Trade {
  const finalStatus: TradeStatus =
    exitReason === 'STOP_LOSS' ? 'STOPPED' :
    exitReason === 'EXPIRED'   ? 'EXPIRED' : 'CLOSED';

  const returnKRW     = (closePrice - trade.openPrice) * trade.shares;
  const returnPercent = ((closePrice - trade.openPrice) / trade.openPrice) * 100;

  return {
    ...trade,
    status: finalStatus,
    closeTime: now,
    closePrice,
    exitReason,
    returnKRW,
    returnPercent,
    holdingDurationMs: now - trade.openTime,
    currentPrice: closePrice,
  };
}

// ── Unrealized PnL ────────────────────────────────────────────────────────────

export function getUnrealizedPnL(trade: Trade, currentPrice: number): number {
  if (trade.status !== 'OPEN') return 0;
  return (currentPrice - trade.openPrice) * trade.shares;
}

export function getUnrealizedPercent(trade: Trade, currentPrice: number): number {
  if (trade.status !== 'OPEN') return 0;
  return ((currentPrice - trade.openPrice) / trade.openPrice) * 100;
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

export function buildSnapshot(
  portfolio: Portfolio,
  openTrades: Trade[],
  closedTrades: Trade[],
  stockPrices: Map<string, number>,
): PortfolioSnapshot {
  let openEquity = 0;
  let unrealizedPnLKRW = 0;
  for (const t of openTrades) {
    const price = stockPrices.get(t.ticker) ?? t.currentPrice ?? t.openPrice;
    openEquity      += price * t.shares;
    unrealizedPnLKRW += getUnrealizedPnL(t, price);
  }

  const realizedPnLKRW = closedTrades
    .filter((t) => !t.isMockData)
    .reduce((s, t) => s + (t.returnKRW ?? 0), 0);

  const mockRealizedPnLKRW = closedTrades
    .filter((t) => t.isMockData)
    .reduce((s, t) => s + (t.returnKRW ?? 0), 0);

  return {
    portfolio,
    openTrades,
    closedTrades,
    totalEquity: portfolio.cash + openEquity,
    unrealizedPnLKRW,
    realizedPnLKRW,
    mockRealizedPnLKRW,
  };
}

// ── Process a market-data poll cycle ─────────────────────────────────────────
// Returns updated trades and the cash delta (positive = received from closes).
// The caller is responsible for persisting to the store.

export interface PollResult {
  updatedOpenTrades: Trade[];
  newlyClosedTrades: Trade[];
  cashDelta: number;
}

export function processPollCycle(
  openTrades: Trade[],
  stockPrices: Map<string, number>,
  now: number = Date.now(),
): PollResult {
  const updatedOpenTrades: Trade[] = [];
  const newlyClosedTrades: Trade[] = [];
  let cashDelta = 0;

  for (const trade of openTrades) {
    const currentPrice = stockPrices.get(trade.ticker) ?? trade.currentPrice ?? trade.openPrice;
    const { shouldClose, reason } = evaluateTrade(trade, currentPrice, now);

    if (shouldClose && reason !== null) {
      const closed = closeTrade(trade, currentPrice, reason, now);
      newlyClosedTrades.push(closed);
      cashDelta += closed.positionValueKRW + (closed.returnKRW ?? 0);
    } else {
      updatedOpenTrades.push({ ...trade, currentPrice });
    }
  }

  return { updatedOpenTrades, newlyClosedTrades, cashDelta };
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export function calculateMetrics(closedTrades: Trade[]): StrategyMetrics {
  const realTrades = closedTrades.filter((t) => !t.isMockData && t.returnPercent !== undefined);
  const mockCount  = closedTrades.filter((t) => t.isMockData).length;

  const wins   = realTrades.filter((t) => (t.returnPercent ?? 0) > 0);
  const losses = realTrades.filter((t) => (t.returnPercent ?? 0) <= 0);

  const avg = (arr: Trade[], key: keyof Trade) =>
    arr.length > 0
      ? arr.reduce((s, t) => s + ((t[key] as number) ?? 0), 0) / arr.length
      : 0;

  const totalWinKRW  = wins.reduce((s, t)   => s + Math.abs(t.returnKRW ?? 0), 0);
  const totalLossKRW = losses.reduce((s, t) => s + Math.abs(t.returnKRW ?? 0), 0);
  const profitFactor = totalLossKRW > 0 ? totalWinKRW / totalLossKRW : Infinity;

  const maxSingleLossPercent =
    losses.length > 0 ? Math.min(...losses.map((t) => t.returnPercent ?? 0)) : 0;

  // By theme
  const byTheme: Record<string, ThemePerf> = {};
  for (const t of realTrades) {
    if (!byTheme[t.theme]) byTheme[t.theme] = { trades: 0, wins: 0, avgReturnPercent: 0 };
    const m = byTheme[t.theme];
    m.trades++;
    if ((t.returnPercent ?? 0) > 0) m.wins++;
    // Rolling average
    m.avgReturnPercent += ((t.returnPercent ?? 0) - m.avgReturnPercent) / m.trades;
  }

  // By risk level
  const byRiskLevel: Partial<Record<RiskLevel, RiskLevelPerf>> = {};
  for (const t of realTrades) {
    const rl = t.riskLevel;
    if (!byRiskLevel[rl]) byRiskLevel[rl] = { trades: 0, wins: 0, avgReturnPercent: 0 };
    const m = byRiskLevel[rl]!;
    m.trades++;
    if ((t.returnPercent ?? 0) > 0) m.wins++;
    m.avgReturnPercent += ((t.returnPercent ?? 0) - m.avgReturnPercent) / m.trades;
  }

  return {
    totalTrades: closedTrades.length,
    realDataTrades: realTrades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: realTrades.length > 0 ? wins.length / realTrades.length : 0,
    avgReturnPercent: avg(realTrades, 'returnPercent'),
    avgWinPercent:    avg(wins,       'returnPercent'),
    avgLossPercent:   avg(losses,     'returnPercent'),
    profitFactor,
    maxSingleLossPercent,
    avgHoldingDurationMs: avg(realTrades, 'holdingDurationMs'),
    byTheme,
    byRiskLevel,
    dataQualityWarning:
      mockCount > 0
        ? `${mockCount}개 트레이드는 샘플 데이터로 집계에서 제외됐어요.`
        : null,
  };
}
