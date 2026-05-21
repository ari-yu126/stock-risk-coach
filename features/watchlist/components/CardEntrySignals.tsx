'use client';

import type { EntrySignalResult, EntrySignalStage } from '../lib/entrySignalTypes';
import { SCALPING_STRATEGY_ORDER, STAGE_LABEL, STRATEGY_NAMES } from '../lib/entrySignalTypes';

const STAGE_STYLE: Record<EntrySignalStage, { badge: string; dot: string }> = {
  wait: { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  approaching: { badge: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  'entry-ready': { badge: 'bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  overheated: { badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
};

function scoreBarColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 55) return 'bg-amber-400';
  return 'bg-gray-300';
}

interface CardEntrySignalsProps {
  signals: EntrySignalResult[];
  loading?: boolean;
}

export function CardEntrySignals({ signals, loading }: CardEntrySignalsProps) {
  const ordered = SCALPING_STRATEGY_ORDER.map((id) => signals.find((s) => s.strategyId === id)).filter(
    (s): s is EntrySignalResult => s != null,
  );

  return (
    <div className="px-5 pb-4">
      <p className="mb-2 text-xs font-semibold text-indigo-800">⚡ 단타 진입 신호</p>

      {loading && ordered.length === 0 ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-indigo-50/50" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <p className="text-xs text-gray-400">신호 계산 중…</p>
      ) : (
        <div className="space-y-2">
          {ordered.map((sig) => (
            <StrategySignalRow key={sig.strategyId} signal={sig} />
          ))}
        </div>
      )}
    </div>
  );
}

function StrategySignalRow({ signal }: { signal: EntrySignalResult }) {
  const style = STAGE_STYLE[signal.stage];
  const { components: c } = signal;

  return (
    <div className="rounded-lg border border-indigo-100/80 bg-indigo-50/30 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-indigo-900">
          {STRATEGY_NAMES[signal.strategyId]}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400">Score</span>
          <span className="text-sm font-bold tabular-nums text-gray-900">{signal.entryScore}</span>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
          >
            <span className={`h-1 w-1 rounded-full ${style.dot}`} />
            {STAGE_LABEL[signal.stage]}
          </span>
        </div>
      </div>

      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/80">
        <div
          className={`h-full rounded-full ${scoreBarColor(signal.entryScore)}`}
          style={{ width: `${signal.entryScore}%` }}
        />
      </div>

      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-gray-600">{signal.summary}</p>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
        <StatusFlag on={signal.canEnter} label="진입" positive />
        <StatusFlag on={signal.isApproaching} label="접근" />
        <StatusFlag on={signal.isOverheated} label="과열" warn />
        <span className="text-gray-300">|</span>
        <span className="text-gray-400">RSI {c.rsi}</span>
        <span className="text-gray-400">Vol {c.volume}</span>
        <span className="text-gray-400">MA {c.maTrend}</span>
      </div>
    </div>
  );
}

function StatusFlag({
  on,
  label,
  positive,
  warn,
}: {
  on: boolean;
  label: string;
  positive?: boolean;
  warn?: boolean;
}) {
  return (
    <span
      className={
        on
          ? warn
            ? 'font-medium text-red-600'
            : positive
              ? 'font-medium text-emerald-600'
              : 'font-medium text-amber-600'
          : 'text-gray-300'
      }
    >
      {label}
      {on ? '✓' : '·'}
    </span>
  );
}
