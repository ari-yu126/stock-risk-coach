'use client';

import { useState, useEffect } from 'react';
import type { Trade } from '../types';
import { getUnrealizedPnL, getUnrealizedPercent } from '../lib/engine';

function fmtKRW(n: number, showSign = false): string {
  const sign = showSign ? (n >= 0 ? '+' : '') : '';
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${sign}${Math.round(n / 10_000).toLocaleString('ko-KR')}만`;
  return `${sign}${n.toLocaleString('ko-KR')}`;
}

function fmtDuration(ms: number): string {
  if (ms <= 0)          return '0초';
  if (ms < 60_000)      return `${Math.round(ms / 1_000)}초`;
  if (ms < 3_600_000)   return `${Math.floor(ms / 60_000)}분`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('ko-KR');
}

function PnLCell({ pct, krw }: { pct: number; krw: number }) {
  const isPos = pct > 0;
  const isZero = pct === 0;
  const cls = isZero ? 'text-gray-500' : isPos ? 'text-emerald-600' : 'text-red-500';
  return (
    <div className={`text-right ${cls}`}>
      <p className="text-sm font-bold tabular-nums">{isPos ? '+' : ''}{pct.toFixed(2)}%</p>
      <p className="text-[11px] tabular-nums">{fmtKRW(krw, true)}만</p>
    </div>
  );
}

function ExpiryBadge({ expiresAt, now }: { expiresAt: number; now: number }) {
  const remaining = expiresAt - now;
  const urgent = remaining < 30 * 60_000; // < 30 min
  return (
    <span className={`text-[11px] tabular-nums ${urgent ? 'font-semibold text-orange-600' : 'text-gray-400'}`}>
      {remaining > 0 ? `만료 ${fmtDuration(remaining)} 전` : '만료됨'}
    </span>
  );
}

export function ActivePositionsTable({
  trades,
  stockPrices,
  onClose,
}: {
  trades: Trade[];
  stockPrices: Map<string, number>;
  onClose: (tradeId: string) => void;
}) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now()); // eslint-disable-line react-hooks/set-state-in-effect
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-gray-400">활성 포지션 없음</p>
        <p className="mt-1 text-xs text-gray-300">후보 종목에 관심 후보 신호가 뜨면 자동 진입해요.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <th className="px-4 py-2.5 text-left">종목</th>
            <th className="px-3 py-2.5 text-right">진입가</th>
            <th className="px-3 py-2.5 text-right">현재가</th>
            <th className="px-3 py-2.5 text-right">평가손익</th>
            <th className="px-3 py-2.5 text-right hidden sm:table-cell">손절/익절</th>
            <th className="px-3 py-2.5 text-right hidden md:table-cell">보유</th>
            <th className="px-3 py-2.5 text-center">데이터</th>
            <th className="px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const currentPrice = stockPrices.get(t.ticker) ?? t.currentPrice ?? t.openPrice;
            const pnlPct = getUnrealizedPercent(t, currentPrice);
            const pnlKRW = getUnrealizedPnL(t, currentPrice);
            const slDist = ((currentPrice - t.stopLossPrice)   / currentPrice) * 100;
            const tpDist = ((t.takeProfitPrice - currentPrice) / currentPrice) * 100;
            const holdingMs = now - t.openTime;

            return (
              <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                {/* Name */}
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-[11px] text-gray-400">{t.sector} · {t.theme}</p>
                  <ExpiryBadge expiresAt={t.expiresAt} now={now} />
                </td>
                {/* Entry price */}
                <td className="px-3 py-3 text-right">
                  <p className="tabular-nums text-gray-700">{fmtPrice(t.openPrice)}</p>
                  <p className="text-[11px] text-gray-400">{t.shares}주</p>
                </td>
                {/* Current price */}
                <td className="px-3 py-3 text-right">
                  <p className="tabular-nums font-medium text-gray-900">{fmtPrice(currentPrice)}</p>
                </td>
                {/* PnL */}
                <td className="px-3 py-3">
                  <PnLCell pct={pnlPct} krw={pnlKRW} />
                </td>
                {/* SL / TP distances */}
                <td className="px-3 py-3 text-right hidden sm:table-cell">
                  <p className="text-[11px] text-red-400 tabular-nums">SL -{slDist.toFixed(1)}%</p>
                  <p className="text-[11px] text-emerald-500 tabular-nums">TP +{tpDist.toFixed(1)}%</p>
                </td>
                {/* Holding time */}
                <td className="px-3 py-3 text-right hidden md:table-cell text-[11px] text-gray-400 tabular-nums">
                  {fmtDuration(holdingMs)}
                </td>
                {/* Data source */}
                <td className="px-3 py-3 text-center">
                  {t.isMockData ? (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      샘플
                    </span>
                  ) : (
                    <span className="rounded-full border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
                      실데이터
                    </span>
                  )}
                </td>
                {/* Manual close */}
                <td className="px-3 py-3">
                  <button
                    onClick={() => onClose(t.id)}
                    className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-red-300 hover:text-red-500"
                  >
                    청산
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
