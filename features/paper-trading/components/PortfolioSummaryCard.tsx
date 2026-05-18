'use client';

import type { PortfolioSnapshot } from '../types';

function fmtKRW(n: number, showSign = false): string {
  const sign = showSign ? (n >= 0 ? '+' : '') : '';
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${sign}${(n / 100_000_000).toFixed(1)}억원`;
  if (abs >= 10_000)      return `${sign}${Math.round(n / 10_000).toLocaleString('ko-KR')}만원`;
  return `${sign}${n.toLocaleString('ko-KR')}원`;
}

function fmtPct(n: number, showSign = false): string {
  const sign = showSign ? (n >= 0 ? '+' : '') : '';
  return `${sign}${n.toFixed(2)}%`;
}

function PnLPill({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isZero     = value === 0;
  const cls = isZero
    ? 'bg-gray-50 border-gray-200 text-gray-500'
    : isPositive
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : 'bg-red-50 border-red-200 text-red-700';
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-base font-bold tabular-nums">{fmtKRW(value, true)}</p>
    </div>
  );
}

export function PortfolioSummaryCard({
  snapshot,
  onReset,
}: {
  snapshot: PortfolioSnapshot;
  onReset: () => void;
}) {
  const { portfolio, openTrades, closedTrades, totalEquity, unrealizedPnLKRW, realizedPnLKRW, mockRealizedPnLKRW } = snapshot;
  const initialCash = portfolio.config.initialCash;
  const totalReturnPct = ((totalEquity - initialCash) / initialCash) * 100;
  const isMockSession = openTrades.some((t) => t.isMockData);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">가상 포트폴리오</h3>
          <p className="text-sm text-gray-400">
            현금 {fmtKRW(portfolio.cash)} · 포지션 {openTrades.length}개 · 종료 {closedTrades.length}건
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMockSession && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
              샘플 데이터
            </span>
          )}
          <span className={`text-lg font-bold tabular-nums ${totalReturnPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmtPct(totalReturnPct, true)}
          </span>
          <button
            onClick={onReset}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-red-300 hover:text-red-500"
          >
            초기화
          </button>
        </div>
      </div>

      {/* Equity headline */}
      <div className="mb-4 rounded-xl bg-gray-50 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">총 자산</p>
        <p className="mt-0.5 text-3xl font-bold tabular-nums text-gray-900">{fmtKRW(totalEquity)}</p>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="text-gray-400">시작</span>
          <span className="font-medium text-gray-600">{fmtKRW(initialCash)}</span>
          <span className="text-gray-400">→ 손익</span>
          <span className={`font-semibold ${totalReturnPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmtKRW(totalEquity - initialCash, true)}
          </span>
        </div>
      </div>

      {/* PnL row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <PnLPill label="실현손익" value={realizedPnLKRW} />
        <PnLPill label="평가손익" value={unrealizedPnLKRW} />
        {mockRealizedPnLKRW !== 0 && (
          <div className="flex flex-col gap-0.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500 opacity-60">샘플손익(제외)</p>
            <p className="text-base font-bold tabular-nums text-amber-700">{fmtKRW(mockRealizedPnLKRW, true)}</p>
          </div>
        )}
      </div>

      {/* Config badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { label: `포지션 ${fmtKRW(portfolio.config.positionSizeKRW)}` },
          { label: `손절 ${fmtPct(portfolio.config.stopLossPercent * 100)}` },
          { label: `익절 ${fmtPct(portfolio.config.takeProfitPercent * 100)}` },
          { label: `최대 ${portfolio.config.maxHoldingMs / 3_600_000}시간` },
          { label: portfolio.config.autoOpen ? '자동매수 ON' : '자동매수 OFF' },
        ].map((b) => (
          <span key={b.label} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-500">
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
