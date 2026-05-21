'use client';

import type { EquityPoint } from '../lib/backtest/types';

interface EquityCurveChartProps {
  points: EquityPoint[];
  initialCapital: number;
  height?: number;
}

export function EquityCurveChart({ points, initialCapital, height = 200 }: EquityCurveChartProps) {
  if (points.length < 2) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-400"
        style={{ height }}
      >
        거래가 없어 자산 곡선을 그릴 수 없어요
      </div>
    );
  }

  const width = 640;
  const pad = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const equities = points.map((p) => p.equity);
  const minE = Math.min(...equities, initialCapital) * 0.995;
  const maxE = Math.max(...equities, initialCapital) * 1.005;
  const range = maxE - minE || 1;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * innerW;
  const toY = (v: number) => pad.top + innerH - ((v - minE) / range) * innerH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(p.equity).toFixed(1)}`)
    .join(' ');

  const baselineY = toY(initialCapital);
  const isUp = points[points.length - 1].equity >= initialCapital;
  const stroke = isUp ? '#059669' : '#dc2626';
  const fillId = 'equity-fill';

  const areaPath = `${linePath} L ${toX(points.length - 1).toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${toX(0).toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

  const fmt = (n: number) =>
    n >= 100_000_000
      ? `${(n / 100_000_000).toFixed(1)}억`
      : `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[320px]"
        role="img"
        aria-label="백테스트 자산 변화 그래프"
      >
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad.top + innerH * (1 - t);
          const val = minE + range * t;
          return (
            <g key={t}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={pad.left - 6} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">
                {fmt(val)}
              </text>
            </g>
          );
        })}

        <line
          x1={pad.left}
          y1={baselineY}
          x2={width - pad.right}
          y2={baselineY}
          stroke="#9ca3af"
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        <path d={areaPath} fill={`url(#${fillId})`} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        <text x={pad.left} y={height - 6} className="fill-gray-400 text-[10px]">
          {points[0].date}
        </text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" className="fill-gray-400 text-[10px]">
          {points[points.length - 1].date}
        </text>
      </svg>
    </div>
  );
}
