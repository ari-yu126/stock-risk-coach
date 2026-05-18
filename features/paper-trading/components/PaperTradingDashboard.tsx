'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Portfolio, Trade, TradeConfig, PortfolioSnapshot } from '../types';
import type { CandidatesResponse } from '@/app/api/candidates/route';
import type { MarketDataResponse } from '@/features/market-data/lib/providers/types';
import {
  tryOpenTrade, processPollCycle, buildSnapshot, calculateMetrics,
  closeTrade,
} from '../lib/engine';
import { createLocalStorageStore } from '../lib/store';
import { DEFAULT_TRADE_CONFIG } from '../lib/defaults';
import { PortfolioSummaryCard } from './PortfolioSummaryCard';
import { ActivePositionsTable } from './ActivePositionsTable';
import { ClosedTradesPanel } from './ClosedTradesPanel';
import { StrategyMetricsCard } from './StrategyMetricsCard';

// ── Config panel ──────────────────────────────────────────────────────────────

function ConfigPanel({
  config,
  onSave,
  onClose,
}: {
  config: TradeConfig;
  onSave: (c: TradeConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(config);

  function num(val: string, fallback: number): number {
    const n = parseFloat(val);
    return isNaN(n) ? fallback : n;
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <p className="mb-3 text-sm font-semibold text-blue-700">전략 설정</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">포지션 크기 (만원)</span>
          <input
            type="number" min={100000} step={100000}
            value={draft.positionSizeKRW / 10_000}
            onChange={(e) => setDraft({ ...draft, positionSizeKRW: num(e.target.value, 100) * 10_000 })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">손절 (%)</span>
          <input
            type="number" min={1} max={30} step={0.5}
            value={draft.stopLossPercent * 100}
            onChange={(e) => setDraft({ ...draft, stopLossPercent: num(e.target.value, 5) / 100 })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">익절 (%)</span>
          <input
            type="number" min={1} max={50} step={0.5}
            value={draft.takeProfitPercent * 100}
            onChange={(e) => setDraft({ ...draft, takeProfitPercent: num(e.target.value, 10) / 100 })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-gray-500">최대 보유 (시간)</span>
          <input
            type="number" min={1} max={72} step={1}
            value={draft.maxHoldingMs / 3_600_000}
            onChange={(e) => setDraft({ ...draft, maxHoldingMs: num(e.target.value, 6) * 3_600_000 })}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </label>
        <label className="flex items-center gap-2 pt-4">
          <input
            type="checkbox" checked={draft.autoOpen}
            onChange={(e) => setDraft({ ...draft, autoOpen: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm text-gray-600">자동 진입 (관심 후보 발생 시)</span>
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">취소</button>
        <button
          onClick={() => { onSave(draft); onClose(); }}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600"
        >
          저장
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000; // sync with WatchlistDashboard intraday interval

export function PaperTradingDashboard() {
  const store = useMemo(() => createLocalStorageStore(), []);

  const [portfolio, setPortfolio]     = useState<Portfolio>(() => ({
    cash: DEFAULT_TRADE_CONFIG.initialCash,
    config: DEFAULT_TRADE_CONFIG,
    lastUpdatedAt: Date.now(),
  }));
  const [openTrades, setOpenTrades]   = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [stockPrices, setStockPrices] = useState<Map<string, number>>(new Map());
  const [lastPollAt, setLastPollAt]   = useState<string | null>(null);
  const [showConfig, setShowConfig]   = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Refs for stable access inside callbacks
  const portfolioRef   = useRef(portfolio);
  const openTradesRef  = useRef(openTrades);
  portfolioRef.current  = portfolio;  // eslint-disable-line react-hooks/refs
  openTradesRef.current = openTrades; // eslint-disable-line react-hooks/refs

  // ── Initialize from store ─────────────────────────────────────────────────

  useEffect(() => {
    const p     = store.loadPortfolio();
    const all   = store.loadTrades();
    const open  = all.filter((t) => t.status === 'OPEN');
    const closed = all.filter((t) => t.status !== 'OPEN');
    setPortfolio(p); // eslint-disable-line react-hooks/set-state-in-effect
    setOpenTrades(open);
    setClosedTrades(closed);
    setInitialized(true);
  }, [store]);

  // ── Core poll: fetch candidates + market data, process lifecycle ──────────

  const poll = useCallback(async () => {
    try {
      // Fetch candidates for entry signals
      const [candidatesRes, marketRes] = await Promise.allSettled([
        fetch('/api/candidates').then((r) => r.ok ? r.json() as Promise<CandidatesResponse> : Promise.reject()),
        ((): Promise<MarketDataResponse> => {
          const tickers = openTradesRef.current.map((t) => t.ticker).join(',');
          const url = tickers ? `/api/market-data?tickers=${tickers}` : '/api/market-data';
          return fetch(url).then((r) => r.ok ? r.json() as Promise<MarketDataResponse> : Promise.reject());
        })(),
      ]);

      // Build a price map from market data
      const prices = new Map<string, number>();
      if (marketRes.status === 'fulfilled') {
        for (const s of marketRes.value.stocks) prices.set(s.ticker, s.price);
      }
      // Also absorb candidate prices (candidates not in watchlist still have a price)
      if (candidatesRes.status === 'fulfilled') {
        for (const c of candidatesRes.value.candidates) {
          if (!prices.has(c.stock.ticker)) prices.set(c.stock.ticker, c.stock.price);
        }
      }
      setStockPrices(new Map(prices));
      setLastPollAt(new Date().toISOString());

      const now = Date.now();
      const currentPortfolio = portfolioRef.current;
      const currentOpen      = openTradesRef.current;

      // ── Evaluate & close open trades ────────────────────────────────────
      const { updatedOpenTrades, newlyClosedTrades, cashDelta } = processPollCycle(
        currentOpen, prices, now,
      );

      // ── Try to open new positions from candidates ────────────────────────
      const newTrades: Trade[] = [];
      if (candidatesRes.status === 'fulfilled') {
        let remainingCash = currentPortfolio.cash + cashDelta;

        for (const candidate of candidatesRes.value.candidates) {
          const currentStock = candidatesRes.value.candidates
            .map((c) => c.stock)
            .find((s) => s.ticker === candidate.stock.ticker);

          if (!currentStock) continue;

          const tempPortfolio: Portfolio = { ...currentPortfolio, cash: remainingCash };
          const newTrade = tryOpenTrade(
            candidate,
            currentStock,
            tempPortfolio,
            [...updatedOpenTrades, ...newTrades],
          );
          if (newTrade) {
            newTrades.push(newTrade);
            remainingCash -= newTrade.positionValueKRW;
          }
        }

        // Compute final cash
        const finalCash = currentPortfolio.cash + cashDelta - newTrades.reduce((s, t) => s + t.positionValueKRW, 0);
        const updatedPortfolio: Portfolio = {
          ...currentPortfolio,
          cash: Math.max(finalCash, 0),
          lastUpdatedAt: now,
        };

        // Persist
        for (const closed of newlyClosedTrades) store.updateTrade(closed.id, closed);
        for (const opened of newTrades)          store.appendTrade(opened);
        store.savePortfolio(updatedPortfolio);

        setPortfolio(updatedPortfolio);
        setOpenTrades([...updatedOpenTrades, ...newTrades]);
        setClosedTrades((prev) => [...prev, ...newlyClosedTrades]);
      } else {
        // Candidates failed — still process closures
        const finalCash = currentPortfolio.cash + cashDelta;
        const updatedPortfolio: Portfolio = {
          ...currentPortfolio,
          cash: Math.max(finalCash, 0),
          lastUpdatedAt: now,
        };
        for (const closed of newlyClosedTrades) store.updateTrade(closed.id, closed);
        store.savePortfolio(updatedPortfolio);

        setPortfolio(updatedPortfolio);
        setOpenTrades(updatedOpenTrades);
        setClosedTrades((prev) => [...prev, ...newlyClosedTrades]);
      }
    } catch {
      // Keep last state on error
    }
  }, [store]);

  useEffect(() => {
    if (!initialized) return;
    void poll(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [initialized, poll]);

  // ── Manual close ─────────────────────────────────────────────────────────

  function handleManualClose(tradeId: string) {
    const trade = openTrades.find((t) => t.id === tradeId);
    if (!trade) return;
    const currentPrice = stockPrices.get(trade.ticker) ?? trade.currentPrice ?? trade.openPrice;
    const closed = closeTrade(trade, currentPrice, 'MANUAL');
    const cashBack = closed.positionValueKRW + (closed.returnKRW ?? 0);
    const updatedPortfolio: Portfolio = {
      ...portfolio,
      cash: portfolio.cash + cashBack,
      lastUpdatedAt: Date.now(),
    };
    store.updateTrade(closed.id, closed);
    store.savePortfolio(updatedPortfolio);
    setPortfolio(updatedPortfolio);
    setOpenTrades((prev) => prev.filter((t) => t.id !== tradeId));
    setClosedTrades((prev) => [...prev, closed]);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  function handleReset() {
    if (!window.confirm('가상 포트폴리오를 초기화하시겠어요? 모든 트레이드 기록이 삭제됩니다.')) return;
    store.clearAll();
    const fresh: Portfolio = {
      cash: portfolio.config.initialCash,
      config: portfolio.config,
      lastUpdatedAt: Date.now(),
    };
    store.savePortfolio(fresh);
    setPortfolio(fresh);
    setOpenTrades([]);
    setClosedTrades([]);
  }

  // ── Config save ────────────────────────────────────────────────────────────

  function handleConfigSave(newConfig: TradeConfig) {
    const updated: Portfolio = { ...portfolio, config: newConfig, lastUpdatedAt: Date.now() };
    store.savePortfolio(updated);
    setPortfolio(updated);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const snapshot: PortfolioSnapshot = useMemo(
    () => buildSnapshot(portfolio, openTrades, closedTrades, stockPrices),
    [portfolio, openTrades, closedTrades, stockPrices],
  );

  const metrics = useMemo(() => calculateMetrics(closedTrades), [closedTrades]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="space-y-4">
      {/* Section header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">가상 매매 시뮬레이션</h2>
          <p className="text-sm text-gray-500">
            실제 체결 없음 · PnL은 네이버 금융 폴링가 기준
            {lastPollAt && (
              <span className="ml-2 text-[11px] text-gray-400">
                마지막 갱신 {new Date(lastPollAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowConfig((v) => !v)}
          aria-expanded={showConfig}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            showConfig
              ? 'border-blue-400 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8" cy="8" r="2.5" />
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.46 11.54l-1.41 1.41" />
          </svg>
          설정
        </button>
      </div>

      {/* Config panel */}
      {showConfig && (
        <ConfigPanel config={portfolio.config} onSave={handleConfigSave} onClose={() => setShowConfig(false)} />
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5 text-xs text-gray-400">
        ⚠️ 가상 매매입니다. 실제 투자 성과와 다를 수 있으며, 전략 수익성을 보장하지 않습니다.
        {snapshot.openTrades.some((t) => t.isMockData) && (
          <span className="ml-1 text-amber-600">샘플 데이터로 열린 포지션은 성과 집계에서 제외됩니다.</span>
        )}
      </div>

      {/* 2-column layout: summary + metrics */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PortfolioSummaryCard snapshot={snapshot} onReset={handleReset} />
        </div>
        <div>
          <StrategyMetricsCard metrics={metrics} />
        </div>
      </div>

      {/* Active positions */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          활성 포지션 <span className="font-normal text-gray-400">({openTrades.length})</span>
        </h3>
        <ActivePositionsTable
          trades={openTrades}
          stockPrices={stockPrices}
          onClose={handleManualClose}
        />
      </div>

      {/* Closed trades */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">
          종료된 트레이드 <span className="font-normal text-gray-400">({closedTrades.length})</span>
        </h3>
        <ClosedTradesPanel trades={closedTrades} />
      </div>
    </section>
  );
}
