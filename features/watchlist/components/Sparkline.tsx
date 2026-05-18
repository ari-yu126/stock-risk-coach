import type { IntradayTrend } from '../lib/intradayData';

interface SparklineProps {
  points: number[];
  trend: IntradayTrend;
  width?: number;
  height?: number;
  className?: string;
}

const TREND_COLOR: Record<IntradayTrend, string> = {
  up:   '#22c55e',
  down: '#3b82f6',
  flat: '#9ca3af',
};

const TREND_FILL: Record<IntradayTrend, string> = {
  up:   'rgba(34,197,94,0.12)',
  down: 'rgba(59,130,246,0.12)',
  flat: 'rgba(156,163,175,0.10)',
};

export function Sparkline({
  points,
  trend,
  width = 80,
  height = 28,
  className = '',
}: SparklineProps) {
  if (points.length < 2) return null;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const coordPairs = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * w;
    const y = pad + (1 - v) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const linePath = `M${coordPairs.join('L')}`;
  // Close area down to baseline
  const lastX = (pad + w).toFixed(1);
  const baseY  = (pad + h).toFixed(1);
  const firstX = (pad).toFixed(1);
  const areaPath = `M${coordPairs[0]}L${coordPairs.join('L')}L${lastX},${baseY}L${firstX},${baseY}Z`;

  const stroke = TREND_COLOR[trend];
  const fill   = TREND_FILL[trend];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={className}
    >
      <path d={areaPath} fill={fill} />
      <path
        d={linePath}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
