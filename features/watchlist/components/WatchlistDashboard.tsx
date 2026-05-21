'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getNotificationSettings,
  saveNotificationSettings,
  requestNotificationPermission,
  notificationPermissionState,
} from '../lib/notifications';
import type { MarketStock } from '@/features/market-data/types';
import type { MarketDataResponse, MarketDataProviderType } from '@/features/market-data/lib/providers/types';
import type { WatchlistItem } from '../types';
import { WatchlistCard } from './WatchlistCard';
import { useWatchlistCommunity } from '../hooks/useWatchlistCommunity';
import { AddStockModal } from './AddStockModal';
import type { EntrySignalResult } from '../lib/entrySignalTypes';
import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import { captureEntrySignals } from '../lib/signalCapture';
import { evaluatePendingSignals } from '../lib/signalEvaluator';
import { Button } from '@/components/ui/Button';
import { SectionLoadingBar } from '@/components/ui/SectionLoadingBar';
import { MOCK_STOCKS, DEFAULT_WATCHLIST_TICKERS } from '../lib/mock-data';
import { loadTickers, saveTickers } from '../lib/storage';
import { calculateRisk } from '../lib/scoring';
import { detectSurgeSignals } from '../lib/surgeDetection';
import { recordSnapshot } from '../lib/momentumHistory';
import { getMarketSession } from '@/features/market-news/lib/marketSession';

// ── Adaptive polling intervals (ms) ──────────────────────────────────────────
const INTERVAL_CLOSED    = 5 * 60_000;   // 5 min — market closed
const INTERVAL_PREMARKET = 60_000;        // 1 min — premarket
const INTERVAL_INTRADAY  = 30_000;        // 30 s  — normal intraday
const INTERVAL_SURGE     = 10_000;        // 10 s  — active surge detected

function computeInterval(stocks: MarketStock[], session: string): number {
  if (session === 'premarket') return INTERVAL_PREMARKET;
  if (session === 'after-market') return INTERVAL_CLOSED;
  if (session === 'intraday') {
    const hasSurge = stocks.some((s) => {
      const { level } = detectSurgeSignals(s);
      return level === 'high' || level === 'critical';
    });
    return hasSurge ? INTERVAL_SURGE : INTERVAL_INTRADAY;
  }
  return INTERVAL_CLOSED; // weekend / unknown
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtInterval(ms: number): string {
  if (ms >= 60_000) return `${ms / 60_000}분`;
  return `${ms / 1_000}초`;
}

function WatchlistToolbar({
  notifPermission,
  notifEnabled,
  onNotifToggle,
  onRefresh,
  onAddStock,
  refreshing = false,
}: {
  notifPermission: 'granted' | 'denied' | 'default' | 'unsupported';
  notifEnabled: boolean;
  onNotifToggle: () => void;
  onRefresh: () => void;
  onAddStock: () => void;
  refreshing?: boolean;
}) {
  return (
    <>
      {notifPermission !== 'unsupported' && notifPermission !== 'denied' && (
        <button
          onClick={onNotifToggle}
          aria-pressed={notifEnabled}
          aria-label={notifEnabled ? '알림 끄기' : '알림 켜기'}
          title={notifEnabled ? '알림 켜짐' : '알림 꺼짐'}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            notifEnabled
              ? 'border-blue-300 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'
          }`}
        >
          <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill={notifEnabled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
            <path d="M8 1a5 5 0 0 1 5 5v3l1.5 2H1.5L3 9V6a5 5 0 0 1 5-5zM6.5 13.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
          </svg>
          알림
        </button>
      )}
      {notifPermission === 'denied' && (
        <span className="text-[11px] text-gray-400">알림 차단됨</span>
      )}
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="수동 새로고침"
        className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.5 8a5.5 5.5 0 1 0-1.5 3.74" />
          <polyline points="13.5,4 13.5,8 9.5,8" />
        </svg>
      </button>
      <Button onClick={onAddStock}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        종목 추가
      </Button>
    </>
  );
}

function WatchlistDataStatus({
  providerType,
  fetchedAt,
  pollingInterval,
}: {
  providerType: MarketDataProviderType;
  fetchedAt: string | null;
  pollingInterval: number;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {providerType === 'naver-finance' ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400" aria-hidden="true" />
          네이버 금융 (실시간)
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
          샘플 데이터
        </span>
      )}
      {fetchedAt && (
        <span className="text-[11px] text-gray-400">
          업데이트 {fmtTime(fetchedAt)} · {fmtInterval(pollingInterval)}마다 자동갱신
        </span>
      )}
    </div>
  );
}

const MOCK_AS_MARKET: MarketStock[] = MOCK_STOCKS.map((s) => ({
  ...s,
  tradingValue: Math.round((s.price * s.volume) / 100_000_000),
  marketType: 'KOSPI' as const,
  priceSource: 'mock' as const,
}));

export function WatchlistDashboard({ embedded = false }: { embedded?: boolean }) {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_WATCHLIST_TICKERS);
  const [allStocks, setAllStocks] = useState<MarketStock[]>(MOCK_AS_MARKET);
  const [providerType, setProviderType] = useState<MarketDataProviderType>('mock');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [pollingInterval, setPollingInterval] = useState(INTERVAL_INTRADAY);
  const [entrySignals, setEntrySignals] = useState<EntrySignalResult[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(false);
  const community = useWatchlistCommunity(tickers);

  const isFirstLoad   = useRef(true);
  const tickersRef    = useRef(tickers);
  const allStocksRef  = useRef(allStocks);
  const intervalIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hiddenRef     = useRef(false);

  tickersRef.current   = tickers;   // eslint-disable-line react-hooks/refs
  allStocksRef.current = allStocks; // eslint-disable-line react-hooks/refs

  const refreshEntrySignals = useCallback(async (stocks: MarketStock[]) => {
    if (stocks.length === 0) {
      setEntrySignals([]);
      return;
    }
    setSignalsLoading(true);
    try {
      const r = await fetch('/api/entry-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stocks: stocks.map((s) => ({
            ticker: s.ticker,
            name: resolveStockName(s.ticker, s.name),
            changePercent: s.changePercent,
            volume: s.volume,
            avgVolume: s.avgVolume,
          })),
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { signals: EntrySignalResult[]; fetchedAt: string };
      setEntrySignals(data.signals);

      const priceByTicker = new Map(stocks.map((s) => [s.ticker, s.price]));
      captureEntrySignals(data.signals, priceByTicker, data.fetchedAt);
      void evaluatePendingSignals();
    } catch {
      // keep last signals on failure
    } finally {
      setSignalsLoading(false);
    }
  }, []);

  // ── Core fetch ────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    if (hiddenRef.current) return; // pause when tab is hidden
    try {
      const currentTickers = tickersRef.current;
      const url = currentTickers.length > 0
        ? `/api/market-data?tickers=${currentTickers.join(',')}`
        : '/api/market-data';
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as MarketDataResponse;

      setAllStocks(data.stocks);
      setProviderType(data.providerType);
      setFetchedAt(data.fetchedAt);

      // Record momentum snapshots for watched tickers
      const now = Date.now();
      for (const stock of data.stocks) {
        if (!currentTickers.includes(stock.ticker)) continue;
        const { level } = detectSurgeSignals(stock);
        recordSnapshot({
          ticker: stock.ticker,
          timestamp: now,
          price: stock.price,
          volume: stock.volume,
          changePercent: stock.changePercent,
          surgeLevel: level,
        });
      }

      // Recompute adaptive interval
      const { session } = getMarketSession();
      const next = computeInterval(data.stocks, session);
      setPollingInterval(next);

      const watched = data.stocks.filter((s) => currentTickers.includes(s.ticker));
      await refreshEntrySignals(watched);
    } catch {
      // Keep last good data; do not reset loading state on refresh failure.
    } finally {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setLoading(false);
      }
    }
  }, [refreshEntrySignals]);

  // ── Adaptive interval scheduling ─────────────────────────────────────────

  useEffect(() => {
    if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
    intervalIdRef.current = setInterval(() => void refresh(), pollingInterval);
    return () => {
      if (intervalIdRef.current !== null) clearInterval(intervalIdRef.current);
    };
  }, [pollingInterval, refresh]);

  // ── Visibility-aware polling ──────────────────────────────────────────────

  useEffect(() => {
    function onVisibility() {
      hiddenRef.current = document.visibilityState === 'hidden';
      if (!hiddenRef.current) void refresh(); // catch up when tab becomes visible
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [refresh]);

  // ── Mount: load persisted tickers + settings, initial fetch ──────────────

  useEffect(() => {
    const persisted = loadTickers();
    tickersRef.current = persisted;
    setTickers(persisted); // eslint-disable-line react-hooks/set-state-in-effect
    const settings = getNotificationSettings();
    setNotifEnabled(settings.enabled);
    setNotifPermission(notificationPermissionState());
    void refresh();
  }, [refresh]);

  // ── Watchlist derivation ─────────────────────────────────────────────────

  const watchlist: WatchlistItem[] = tickers
    .map((ticker) => allStocks.find((s) => s.ticker === ticker))
    .filter((s): s is MarketStock => s !== undefined)
    .map((s) => ({ stock: s, riskScore: calculateRisk(s) }));

  const signalsByTicker = useMemo(() => {
    const map = new Map<string, EntrySignalResult[]>();
    for (const sig of entrySignals) {
      const list = map.get(sig.ticker) ?? [];
      list.push(sig);
      map.set(sig.ticker, list);
    }
    return map;
  }, [entrySignals]);

  const handleManualRefresh = useCallback(() => {
    setRefreshing(true);
    void refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleAdd(ticker: string) {
    const next = [...tickers, ticker];
    tickersRef.current = next;
    setTickers(next);
    saveTickers(next);
    void refresh();
  }

  function handleRemove(ticker: string) {
    const next = tickers.filter((t) => t !== ticker);
    setTickers(next);
    saveTickers(next);
  }

  async function handleNotifToggle() {
    if (!notifEnabled) {
      const granted = await requestNotificationPermission();
      setNotifPermission(notificationPermissionState());
      if (granted) {
        setNotifEnabled(true);
        saveNotificationSettings({ enabled: true });
      }
    } else {
      setNotifEnabled(false);
      saveNotificationSettings({ enabled: false });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section id={embedded ? undefined : 'watchlist-analysis'}>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <h2 id="watchlist-analysis-title" className="text-lg font-bold text-gray-900">
            내 관심종목 분석
          </h2>
          <div className="flex flex-wrap items-start justify-end gap-2">
            {!loading && (
              <WatchlistDataStatus
                providerType={providerType}
                fetchedAt={fetchedAt}
                pollingInterval={pollingInterval}
              />
            )}
            <WatchlistToolbar
              notifPermission={notifPermission}
              notifEnabled={notifEnabled}
              onNotifToggle={() => void handleNotifToggle()}
              onRefresh={handleManualRefresh}
              onAddStock={() => setModalOpen(true)}
              refreshing={refreshing}
            />
          </div>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">내 관심 종목</h2>
            <p className="text-sm text-gray-500">{tickers.length}개 종목</p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            {!loading && (
              <WatchlistDataStatus
                providerType={providerType}
                fetchedAt={fetchedAt}
                pollingInterval={pollingInterval}
              />
            )}
            <WatchlistToolbar
              notifPermission={notifPermission}
              notifEnabled={notifEnabled}
              onNotifToggle={() => void handleNotifToggle()}
              onRefresh={handleManualRefresh}
              onAddStock={() => setModalOpen(true)}
              refreshing={refreshing}
            />
          </div>
        </div>
      )}

      <SectionLoadingBar active={loading || refreshing} />

      {loading ? (
        <div role="status" aria-label="관심 종목 로딩 중" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {DEFAULT_WATCHLIST_TICKERS.map((t) => (
            <div key={t} className="h-64 animate-pulse rounded-xl border border-gray-100 bg-white" />
          ))}
        </div>
      ) : tickers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center">
          <p className="text-gray-500">관심 종목이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-400">위의 버튼을 눌러 종목을 추가하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {watchlist.map((item) => (
            <WatchlistCard
              key={item.stock.ticker}
              item={item}
              onRemove={handleRemove}
              entrySignals={signalsByTicker.get(item.stock.ticker) ?? []}
              signalsLoading={signalsLoading}
              community={community.byTicker.get(item.stock.ticker) ?? null}
            />
          ))}
          {tickers
            .filter((t) => !allStocks.some((s) => s.ticker === t))
            .map((t) => (
              <div key={t} className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-4 text-xs text-gray-400">
                {t} — 데이터 없음
              </div>
            ))}
        </div>
      )}

      <AddStockModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        watchedTickers={tickers}
        onAdd={handleAdd}
      />
    </section>
  );
}
