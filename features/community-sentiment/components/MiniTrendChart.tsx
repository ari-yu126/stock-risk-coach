'use client';

interface MiniTrendChartProps {
  values: number[];
  labels?: string[];
  color?: string;
  height?: number;
  label: string;
}

export function MiniTrendChart({
  values,
  color = '#2563eb',
  height = 80,
  label,
}: MiniTrendChartProps) {
  if (values.length < 2) {
    return (
      <div className="text-xs text-gray-400" style={{ height }}>
        데이터 없음
      </div>
    );
  }

  const width = 280;
  const pad = 8;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2);
    const y = pad + (height - pad * 2) - ((v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-gray-500">{label}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={label}>
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>
    </div>
  );
}
