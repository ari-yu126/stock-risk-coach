'use client';

import type { StrategyMetrics } from '../types';

function fmtDuration(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms < 60_000)    return `${Math.round(ms / 1_000)}초`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}분`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function WinRateBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const cls = pct >= 60 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-bold tabular-nums text-gray-700">{pct}%</span>
    </div>
  );
}

function MetricRow({ label, value, sub, valueClass = 'text-gray-800' }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="flex flex-col items-end">
        <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>{value}</span>
        {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
      </span>
    </div>
  );
}

export function StrategyMetricsCard({ metrics }: { metrics: StrategyMetrics }) {
  const {
    totalTrades, realDataTrades, winCount, lossCount, winRate,
    avgReturnPercent, avgWinPercent, avgLossPercent,
    profitFactor, maxSingleLossPercent, avgHoldingDurationMs,
    byTheme, byRiskLevel, dataQualityWarning,
  } = metrics;

  const hasRealData = realDataTrades > 0;
  const pfDisplay = profitFactor === Infinity ? '∞' : profitFactor.toFixed(2);

  const riskOrder = ['낮음', '보통', '높음', '위험'] as const;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-base font-semibold text-gray-900">전략 성과</h3>

      {/* Data quality warning */}
      {dataQualityWarning && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠️ {dataQualityWarning}
        </div>
      )}

      {!hasRealData && (
        <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          실제 데이터 트레이드 없음 — 종료 후 집계됩니다
        </div>
      )}

      {hasRealData && (
        <div className="space-y-5">
          {/* Win rate */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">승률</span>
              <span className="text-[11px] text-gray-400">{winCount}승 / {lossCount}패</span>
            </div>
            <WinRateBar rate={winRate} />
          </div>

          {/* Core metrics */}
          <div className="space-y-2 rounded-lg bg-gray-50 p-3">
            <MetricRow
              label="평균 수익률"
              value={`${avgReturnPercent >= 0 ? '+' : ''}${avgReturnPercent.toFixed(2)}%`}
              valueClass={avgReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <MetricRow
              label="평균 수익 (승)"
              value={`+${avgWinPercent.toFixed(2)}%`}
              valueClass="text-emerald-600"
            />
            <MetricRow
              label="평균 손실 (패)"
              value={`${avgLossPercent.toFixed(2)}%`}
              valueClass="text-red-500"
            />
            <MetricRow
              label="수익 팩터"
              value={pfDisplay}
              sub="총수익 / 총손실"
              valueClass={profitFactor >= 1.5 ? 'text-emerald-600' : profitFactor < 1 ? 'text-red-500' : 'text-gray-700'}
            />
            <MetricRow
              label="최대 단일 손실"
              value={`${maxSingleLossPercent.toFixed(2)}%`}
              valueClass="text-red-500"
            />
            <MetricRow
              label="평균 보유 시간"
              value={fmtDuration(avgHoldingDurationMs)}
            />
            <MetricRow
              label="분석 대상 트레이드"
              value={`${realDataTrades}건`}
              sub={`전체 ${totalTrades}건 중`}
            />
          </div>

          {/* By theme */}
          {Object.keys(byTheme).length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">테마별</p>
              <div className="space-y-1">
                {Object.entries(byTheme)
                  .sort((a, b) => b[1].avgReturnPercent - a[1].avgReturnPercent)
                  .map(([theme, m]) => (
                    <div key={theme} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{theme}</span>
                      <span className="flex items-center gap-2 text-gray-400">
                        <span className="tabular-nums">{m.wins}/{m.trades}</span>
                        <span className={`font-semibold tabular-nums ${m.avgReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {m.avgReturnPercent >= 0 ? '+' : ''}{m.avgReturnPercent.toFixed(1)}%
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* By risk level */}
          {Object.keys(byRiskLevel).length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">위험도별</p>
              <div className="space-y-1">
                {riskOrder
                  .filter((rl) => byRiskLevel[rl])
                  .map((rl) => {
                    const m = byRiskLevel[rl]!;
                    return (
                      <div key={rl} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{rl}</span>
                        <span className="flex items-center gap-2 text-gray-400">
                          <span className="tabular-nums">{m.wins}/{m.trades}</span>
                          <span className={`font-semibold tabular-nums ${m.avgReturnPercent >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {m.avgReturnPercent >= 0 ? '+' : ''}{m.avgReturnPercent.toFixed(1)}%
                          </span>
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
