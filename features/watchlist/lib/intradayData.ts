export type IntradayTrend = 'up' | 'down' | 'flat';

export interface IntradaySeries {
  ticker: string;
  points: number[];     // normalized 0–1, for sparkline rendering
  trend: IntradayTrend;
}

export function getIntradaySeries(
  ticker: string,
  changePercent: number,
): IntradaySeries {
  // Deterministic pseudo-random seed from ticker so same ticker always looks the same
  const seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const POINTS = 24;
  const values: number[] = [];
  let current = 1.0;

  for (let i = 0; i < POINTS; i++) {
    const progress = i / (POINTS - 1);
    const drift = (changePercent / 100) * progress;
    // Two deterministic sine waves for a realistic-looking price path
    const noise =
      Math.sin(seed * (i + 1) * 7.3 + seed * 0.01) * 0.008 +
      Math.cos(seed * (i + 1) * 3.7 + seed * 0.02) * 0.004;
    current = 1.0 + drift + noise;
    values.push(current);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const points =
    range === 0
      ? values.map(() => 0.5)
      : values.map((v) => (v - min) / range);

  const trend: IntradayTrend =
    changePercent > 0.5 ? 'up' : changePercent < -0.5 ? 'down' : 'flat';

  return { ticker, points, trend };
}
