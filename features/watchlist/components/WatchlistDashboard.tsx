'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MarketStock } from '@/features/market-data/types';
import type { MarketDataResponse, MarketDataProviderType } from '@/features/market-data/lib/providers/types';
import type { WatchlistItem } from '../types';
import { WatchlistCard } from './WatchlistCard';
import { AddStockModal } from './AddStockModal';
import { Button } from '@/components/ui/Button';
import { MOCK_STOCKS, DEFAULT_WATCHLIST_TICKERS } from '../lib/mock-data';
import { loadTickers, saveTickers } from '../lib/storage';
import { calculateRisk } from '../lib/scoring';

const AUTO_REFRESH_MS = 30_000;

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Convert mock Stock → MarketStock for fallback
const MOCK_AS_MARKET: MarketStock[] = MOCK_STOCKS.map((s) => ({
  ...s,
  tradingValue: Math.round((s.price * s.volume) / 100_000_000),
  marketType: 'KOSPI' as const,
  priceSource: 'mock' as const,
}));

export function WatchlistDashboard() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_WATCHLIST_TICKERS);
  const [allStocks, setAllStocks] = useState<MarketStock[]>(MOCK_AS_MARKET);
  const [providerType, setProviderType] = useState<MarketDataProviderType>('mock');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const isFirstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/market-data');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as MarketDataResponse;
      setAllStocks(data.stocks);
      setProviderType(data.providerType);
      setFetchedAt(data.fetchedAt);
    } catch {
      // First load: keep MOCK_AS_MARKET (already set). Subsequent: keep last good data.
    } finally {
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        setLoading(false);
      }
    }
  }, []);

  // Load persisted tickers on mount (client-only; runs after SSR hydration).
  useEffect(() => {
    setTickers(loadTickers()); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    // All setState calls inside refresh() are async (after await), not synchronous.
    void refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => void refresh(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Derive watchlist from watched tickers + live stock data
  const watchlist: WatchlistItem[] = tickers
    .map((ticker) => allStocks.find((s) => s.ticker === ticker))
    .filter((s): s is MarketStock => s !== undefined)
    .map((s) => ({ stock: s, riskScore: calculateRisk(s) }));

  function handleAdd(ticker: string) {
    const next = [...tickers, ticker];
    setTickers(next);
    saveTickers(next);
    void refresh();
  }

  function handleRemove(ticker: string) {
    const next = tickers.filter((t) => t !== ticker);
    setTickers(next);
    saveTickers(next);
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">내 관심 종목</h2>
          <p className="text-sm text-gray-500">{tickers.length}개 종목</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Provider badge + update time */}
          {!loading && (
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
                  업데이트 {fmtTime(fetchedAt)} · {AUTO_REFRESH_MS / 1000}초마다 자동갱신
                </span>
              )}
            </div>
          )}

          {/* Manual refresh */}
          <button
            onClick={refresh}
            aria-label="수동 새로고침"
            className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600"
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8a5.5 5.5 0 1 0-1.5 3.74" />
              <polyline points="13.5,4 13.5,8 9.5,8" />
            </svg>
          </button>

          <Button onClick={() => setModalOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            종목 추가
          </Button>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-label="관심 종목 로딩 중" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {watchlist.map((item) => (
            <WatchlistCard key={item.stock.ticker} item={item} onRemove={handleRemove} />
          ))}
          {/* Placeholder for tickers with no live data yet */}
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
