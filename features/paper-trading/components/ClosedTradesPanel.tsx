'use client';

import { useState } from 'react';
import type { Trade, TradeExitReason } from '../types';

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 60_000)    return `${Math.round(ms / 1_000)}초`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}분`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtPrice(n: number): string {
  return n.toLocaleString('ko-KR');
}

const EXIT_LABEL: Record<TradeExitReason, { label: string; cls: string }> = {
  TAKE_PROFIT: { label: '익절',   cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  STOP_LOSS:   { label: '손절',   cls: 'bg-red-50 border-red-200 text-red-600' },
  EXPIRED:     { label: '만료',   cls: 'bg-gray-100 border-gray-200 text-gray-500' },
  MANUAL:      { label: '수동',   cls: 'bg-blue-50 border-blue-200 text-blue-600' },
};

type SortKey = 'time' | 'return' | 'duration';

export function ClosedTradesPanel({ trades }: { trades: Trade[] }) {
  const [sortBy, setSortBy] = useState<SortKey>('time');
  const [showMock, setShowMock] = useState(false);

  const visible = trades
    .filter((t) => showMock || !t.isMockData)
    .slice()
    .sort((a, b) => {
      switch (sortBy) {
        case 'time':     return (b.closeTime ?? 0) - (a.closeTime ?? 0);
        case 'return':   return (b.returnPercent ?? 0) - (a.returnPercent ?? 0);
        case 'duration': return (a.holdingDurationMs ?? 0) - (b.holdingDurationMs ?? 0);
      }
    });

  const mockCount = trades.filter((t) => t.isMockData).length;

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center">
        <p className="text-sm text-gray-400">종료된 트레이드 없음</p>
        <p className="mt-1 text-xs text-gray-300">손절/익절/만료 조건 도달 시 자동으로 기록돼요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-2.5">
        <span className="text-[11px] font-semibold text-gray-400">정렬</span>
        {(['time', 'return', 'duration'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            aria-pressed={sortBy === k}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              sortBy === k
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-200 text-gray-500 hover:text-blue-500'
            }`}
          >
            {k === 'time' ? '최근순' : k === 'return' ? '수익률↓' : '단기순'}
          </button>
        ))}
        {mockCount > 0 && (
          <button
            onClick={() => setShowMock((v) => !v)}
            aria-pressed={showMock}
            className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              showMock
                ? 'border-amber-400 bg-amber-50 text-amber-700'
                : 'border-gray-200 text-gray-400 hover:text-amber-600'
            }`}
          >
            샘플 {showMock ? '포함' : '숨김'} ({mockCount})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-2 text-left">종목</th>
              <th className="px-3 py-2 text-right">진입→청산</th>
              <th className="px-3 py-2 text-right">수익률</th>
              <th className="px-3 py-2 text-right hidden sm:table-cell">보유</th>
              <th className="px-3 py-2 text-center">사유</th>
              <th className="px-3 py-2 text-center hidden sm:table-cell">데이터</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const ret = t.returnPercent ?? 0;
              const retCls = ret > 0 ? 'text-emerald-600' : ret < 0 ? 'text-red-500' : 'text-gray-400';
              const exitStyle = t.exitReason ? EXIT_LABEL[t.exitReason] : EXIT_LABEL.MANUAL;
              return (
                <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-[11px] text-gray-400">{t.theme} · {t.sector}</p>
                    <p className="text-[10px] text-gray-300">{fmtDate(t.openTime)}</p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <p className="text-xs text-gray-600">{fmtPrice(t.openPrice)}</p>
                    <p className="text-xs font-medium text-gray-800">{fmtPrice(t.closePrice ?? 0)}</p>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <p className={`font-bold tabular-nums ${retCls}`}>{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%</p>
                    {t.returnKRW !== undefined && (
                      <p className={`text-[11px] tabular-nums ${retCls}`}>
                        {t.returnKRW >= 0 ? '+' : ''}{Math.round(t.returnKRW / 10_000)}만
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <p className="text-[11px] text-gray-400 tabular-nums">{fmtDuration(t.holdingDurationMs ?? 0)}</p>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${exitStyle.cls}`}>
                      {exitStyle.label}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    {t.isMockData ? (
                      <span className="text-[10px] text-amber-500">샘플</span>
                    ) : (
                      <span className="text-[10px] text-blue-500">실데이터</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
