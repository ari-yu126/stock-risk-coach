'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CandlesResponse } from '../lib/candles/types';
import { loadTickers, WATCHLIST_CHANGED_EVENT } from '@/features/watchlist/lib/storage';
import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import { runBacktest } from '../lib/backtest/engine';
import { STRATEGY_CATALOG, getStrategyMeta } from '../lib/backtest/strategies';
import type { BacktestResult, StrategyId } from '../lib/backtest/types';
import { DEFAULT_BACKTEST_CONFIG } from '../lib/backtest/types';
import { EquityCurveChart } from './EquityCurveChart';

function fmtPct(n: number, signed = true): string {
  const s = signed && n > 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
}

function MetricCard({
  label,
  value,
  sub,
  valueClass = 'text-gray-900',
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}

function StrategyResultColumn({
  result,
  selected,
  onSelect,
}: {
  result: BacktestResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = getStrategyMeta(result.strategyId);
  const retCls =
    result.totalReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        selected
          ? 'border-blue-400 bg-blue-50/60 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-blue-200'
      }`}
    >
      <p className="text-sm font-semibold text-gray-900">{meta.name}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
        <span className={retCls}>{fmtPct(result.totalReturnPercent)}</span>
      </p>
      <p className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <span className="text-gray-500">승률</span>
        <span className="text-right font-semibold tabular-nums text-gray-800">
          {(result.winRate * 100).toFixed(1)}%
        </span>
        <span className="text-gray-500">평균 수익</span>
        <span
          className={`text-right font-semibold tabular-nums ${
            result.avgReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {fmtPct(result.avgReturnPercent)}
        </span>
        <span className="text-gray-500">MDD</span>
        <span className="text-right font-semibold tabular-nums text-red-500">
          −{result.maxDrawdownPercent.toFixed(2)}%
        </span>
        <span className="text-gray-500">거래 횟수</span>
        <span className="text-right font-semibold tabular-nums text-gray-800">
          {result.tradeCount}회
          {result.tradeCount < 8 && (
            <span className="ml-1 font-normal text-gray-400">(신호 적음)</span>
          )}
        </span>
      </p>
    </button>
  );
}

export function BacktestSection() {
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [ticker, setTicker] = useState('');
  const [candleData, setCandleData] = useState<CandlesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedId, setSelectedId] = useState<StrategyId>('volume-breakout');

  const syncWatchlistTickers = useCallback(() => {
    const tickers = loadTickers();
    setWatchlistTickers(tickers);
    setTicker((prev) => {
      if (prev && tickers.includes(prev)) return prev;
      return tickers[0] ?? '';
    });
  }, []);

  useEffect(() => {
    syncWatchlistTickers();
    window.addEventListener(WATCHLIST_CHANGED_EVENT, syncWatchlistTickers);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, syncWatchlistTickers);
  }, [syncWatchlistTickers]);

  useEffect(() => {
    if (!ticker) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetch(`/api/candles?ticker=${ticker}&days=180`)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json() as Promise<CandlesResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setCandleData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [ticker]);

  const results = useMemo(() => {
    if (!candleData?.candles.length) return null;
    return STRATEGY_CATALOG.map((s) =>
      runBacktest(candleData.candles, s.id, DEFAULT_BACKTEST_CONFIG),
    );
  }, [candleData]);

  const selectedResult = results?.find((r) => r.strategyId === selectedId) ?? null;
  const selectedMeta = getStrategyMeta(selectedId);
  const stockName = resolveStockName(
    ticker,
    candleData?.ticker === ticker ? candleData.name : undefined,
  );

  return (
    <div className="space-y-4 rounded-xl border border-violet-100 bg-violet-50/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-gray-900">
          {stockName || '종목 선택'}
          {ticker && (
            <span className="ml-1.5 text-xs font-normal text-gray-400">{ticker}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="text-xs font-medium text-gray-500">종목</span>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              disabled={watchlistTickers.length === 0}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-50"
            >
              {watchlistTickers.map((t) => {
                const name = resolveStockName(
                  t,
                  candleData?.ticker === t ? candleData.name : undefined,
                );
                return (
                  <option key={t} value={t}>
                    {name} ({t})
                  </option>
                );
              })}
            </select>
          </label>
          {candleData && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                candleData.source === 'naver-fchart'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              {candleData.source === 'naver-fchart' ? '네이버 일봉' : '합성 일봉(데모)'}
            </span>
          )}
        </div>
      </div>

      {watchlistTickers.length === 0 && (
        <p className="rounded-xl border border-dashed border-violet-200 bg-white py-10 text-center text-sm text-gray-500">
          관심종목이 없습니다. 위 <strong>내 관심 종목</strong>에서 종목을 추가하면 백테스트할 수 있습니다.
        </p>
      )}

      {watchlistTickers.length > 0 && loading && (
        <div className="h-48 animate-pulse rounded-xl bg-white/80" role="status" aria-label="백테스트 로딩 중" />
      )}

      {watchlistTickers.length > 0 && error && (
        <p className="rounded-xl border border-red-100 bg-red-50 py-8 text-center text-sm text-red-600">
          캔들 데이터를 불러오지 못했어요.
        </p>
      )}

      {watchlistTickers.length > 0 && !loading && !error && results && selectedResult && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {results.map((r) => (
              <StrategyResultColumn
                key={r.strategyId}
                result={r}
                selected={r.strategyId === selectedId}
                onSelect={() => setSelectedId(r.strategyId)}
              />
            ))}
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4">
            <p className="text-sm font-semibold text-blue-800">{selectedMeta.name} 공식</p>
            <p className="mt-1 text-xs text-gray-600">{selectedMeta.shortDescription}</p>
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              {selectedMeta.formulaLines.map((line) => (
                <li key={line} className="font-mono leading-relaxed">
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              label="총수익률"
              value={fmtPct(selectedResult.totalReturnPercent)}
              valueClass={
                selectedResult.totalReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'
              }
            />
            <MetricCard
              label="승률"
              value={`${(selectedResult.winRate * 100).toFixed(1)}%`}
              sub={`${selectedResult.trades.filter((t) => t.returnPercent > 0).length}승 / ${selectedResult.tradeCount}회`}
            />
            <MetricCard
              label="평균 수익"
              value={fmtPct(selectedResult.avgReturnPercent)}
              sub="거래당 평균"
              valueClass={
                selectedResult.avgReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'
              }
            />
            <MetricCard
              label="최대 손실 (MDD)"
              value={`−${selectedResult.maxDrawdownPercent.toFixed(2)}%`}
              sub="고점 대비 최대 낙폭"
              valueClass="text-red-500"
            />
            <MetricCard
              label="거래 횟수"
              value={`${selectedResult.tradeCount}회`}
              sub={`최대 ${DEFAULT_BACKTEST_CONFIG.maxHoldDays}거래일 보유 · 일봉 기준`}
            />
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">
                자산 변화 — {selectedMeta.name}
              </p>
              <p className="text-xs text-gray-400">
                시작 {DEFAULT_BACKTEST_CONFIG.initialCapital.toLocaleString('ko-KR')}원
              </p>
            </div>
            <EquityCurveChart
              points={selectedResult.equityCurve}
              initialCapital={DEFAULT_BACKTEST_CONFIG.initialCapital}
            />
          </div>

          <p className="text-[11px] text-gray-400">
            백테스트는 과거 데이터 시뮬레이션이며 미래 수익을 보장하지 않습니다. 슬리피지·수수료·호가 공백은
            반영하지 않았습니다.
          </p>
        </>
      )}
    </div>
  );
}
