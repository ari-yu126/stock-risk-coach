'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ConfidenceTrend, TrackedSignal } from '../lib/signalTrackingTypes';
import {
  createEmptySignalPerformanceSnapshot,
  getSignalPerformanceSnapshot,
} from '../lib/signalPerformance';
import type { SignalPerformanceSnapshot } from '../lib/signalTrackingTypes';
import { SIGNAL_TRACKING_UPDATED_EVENT } from '../lib/signalLogStore';
import { evaluatePendingSignals } from '../lib/signalEvaluator';
import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import { STAGE_LABEL } from '../lib/entrySignalTypes';
import { DEFAULT_BACKTEST_CONFIG } from '@/features/paper-trading/lib/backtest/types';

const TP = Math.round(DEFAULT_BACKTEST_CONFIG.takeProfitPercent * 100);
const SL = Math.round(DEFAULT_BACKTEST_CONFIG.stopLossPercent * 100);

const TREND_LABEL: Record<ConfidenceTrend, { text: string; cls: string; icon: string }> = {
  up: { text: '신뢰도 상승', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: '↑' },
  down: { text: '신뢰도 하락', cls: 'text-red-700 bg-red-50 border-red-200', icon: '↓' },
  flat: { text: '신뢰도 유지', cls: 'text-gray-600 bg-gray-50 border-gray-200', icon: '→' },
};

function fmtPct(n: number, signed = true): string {
  const s = signed && n > 0 ? '+' : '';
  return `${s}${n.toFixed(2)}%`;
}

export function SignalPerformanceSection() {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<SignalPerformanceSnapshot>(
    createEmptySignalPerformanceSnapshot,
  );
  const [evaluating, setEvaluating] = useState(false);

  const refresh = useCallback(() => {
    setSnapshot(getSignalPerformanceSnapshot());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();
    window.addEventListener(SIGNAL_TRACKING_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(SIGNAL_TRACKING_UPDATED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    setEvaluating(true);
    void evaluatePendingSignals().finally(() => {
      if (!cancelled) {
        setEvaluating(false);
        refresh();
      }
    });
    return () => { cancelled = true; };
  }, [mounted, refresh]);

  const overallTrend = TREND_LABEL[snapshot.overallConfidenceTrend];
  const hasData = snapshot.evaluatedCount > 0 || snapshot.pendingCount > 0;

  return (
    <div className="space-y-4 rounded-xl border border-teal-100 bg-teal-50/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-teal-900">실시간 전략 성과 (익일 평가)</h3>
          <p className="mt-0.5 text-xs text-teal-800/80">
            진입 가능 신호 발생 → 다음 거래일 종가 기준 자동 채점 · 익절 {TP}% / 손절 {SL}%
          </p>
        </div>
        {mounted && evaluating && (
          <span className="text-[11px] text-gray-400">평가 갱신 중…</span>
        )}
      </div>

      {!mounted ? (
        <div
          className="h-32 animate-pulse rounded-lg border border-dashed border-teal-200 bg-white/60"
          role="status"
          aria-label="전략 성과 로딩 중"
        />
      ) : !hasData ? (
        <p className="rounded-lg border border-dashed border-teal-200 bg-white/60 py-8 text-center text-sm text-gray-500">
          관심종목에서 <strong>진입 가능</strong> 신호가 발생하면 익일 종가로 자동 평가됩니다.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="최근 전략 적중률"
              value={`${(snapshot.overallRecentAccuracy * 100).toFixed(1)}%`}
              sub={`최근 ${Math.min(10, snapshot.evaluatedCount)}건 기준`}
            />
            <SummaryCard
              label="이전 구간 적중률"
              value={`${(snapshot.overallPriorAccuracy * 100).toFixed(1)}%`}
              sub="비교 기준"
            />
            <SummaryCard
              label="평가 대기"
              value={`${snapshot.pendingCount}건`}
              sub="다음 거래일 종가 대기"
            />
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-medium text-gray-500">전략 신뢰도</p>
              <p className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-semibold ${overallTrend.cls}`}>
                <span>{overallTrend.icon}</span>
                {overallTrend.text}
              </p>
              <p className="mt-1 text-[10px] text-gray-400">최근 vs 이전 구간 적중률 비교</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {snapshot.strategies.map((s) => {
              const trend = TREND_LABEL[s.confidenceTrend];
              return (
                <div key={s.strategyId} className="rounded-xl border border-white bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900">{s.strategyName}</p>
                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${trend.cls}`}>
                      {trend.icon} {trend.text}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
                    {(s.recentAccuracy * 100).toFixed(1)}%
                    <span className="ml-1 text-xs font-normal text-gray-400">최근 적중</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    누적 {(s.accuracy * 100).toFixed(1)}% · 평가 {s.evaluatedCount}건 · 대기 {s.pendingCount}
                  </p>
                </div>
              );
            })}
          </div>

          {snapshot.successRateTrend.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-3 text-sm font-semibold text-gray-800">최근 성공률 변화</p>
              <div className="flex h-24 items-end gap-2">
                {snapshot.successRateTrend.map((p) => (
                  <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[40px] rounded-t bg-teal-500/80 transition-all"
                      style={{ height: `${Math.max(6, Math.round(p.rate * 88))}px` }}
                      title={`${(p.rate * 100).toFixed(0)}% (${p.count}건)`}
                    />
                    <span className="text-[10px] text-gray-400">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-gray-800">최근 신호 결과</p>
            {snapshot.recentResults.length === 0 ? (
              <p className="text-xs text-gray-400">아직 평가 완료된 신호가 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {snapshot.recentResults.map((r) => (
                  <ResultRow key={r.id} record={r} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

function ResultRow({ record }: { record: TrackedSignal }) {
  const ev = record.evaluation!;
  const ok = ev.success;

  return (
    <li className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs">
      <div className="min-w-0">
        <span className="font-semibold text-gray-900">{resolveStockName(record.ticker, record.name)}</span>
        <span className="mx-1 text-gray-300">·</span>
        <span className="text-indigo-700">{record.strategyName}</span>
        <span className="mx-1 text-gray-300">·</span>
        <span className="text-gray-400">{record.signalDate} → {ev.evalDate}</span>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {STAGE_LABEL[record.stage]} · Score {record.entryScore} · 진입 {record.entryPrice.toLocaleString()}원
        </p>
      </div>
      <div className="text-right">
        <span className={`font-bold tabular-nums ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
          {ok ? '성공' : '실패'} {fmtPct(ev.returnPercent)}
        </span>
        <p className="mt-0.5 tabular-nums text-[10px] text-gray-400">
          ↑{ev.maxUpsidePercent.toFixed(1)}% ↓{ev.maxDownsidePercent.toFixed(1)}%
          {ev.hitTakeProfit && ' · 익절'}
          {ev.hitStopLoss && ' · 손절'}
        </p>
      </div>
    </li>
  );
}
