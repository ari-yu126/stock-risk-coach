import type { SurgeLevel } from './surgeDetection';

const STORAGE_PREFIX = 'stock-risk-coach.momentum.v1.';
const MAX_SNAPSHOTS  = 120;
const MAX_AGE_MS     = 6 * 60 * 60 * 1000; // 6 hours

export interface MomentumSnapshot {
  ticker: string;
  timestamp: number;  // Date.now()
  price: number;
  volume: number;
  changePercent: number;
  surgeLevel: SurgeLevel;
}

export type MomentumDirection = 'accelerating' | 'fading' | 'sideways';

export interface MomentumAnalysis {
  direction: MomentumDirection;
  confidence: number;    // 0–1
  summary: string;
  signalCount: number;
  snapshotCount: number;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export function recordSnapshot(snap: MomentumSnapshot): void {
  if (typeof window === 'undefined') return;
  const key = `${STORAGE_PREFIX}${snap.ticker}`;
  const existing = loadSnapshots(snap.ticker);
  const now = Date.now();

  const pruned = existing
    .filter((s) => now - s.timestamp < MAX_AGE_MS)
    .concat(snap)
    .slice(-MAX_SNAPSHOTS);

  try {
    localStorage.setItem(key, JSON.stringify(pruned));
  } catch {
    // Storage full — keep only the new snapshot
    try {
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify([snap]));
    } catch {
      // silently fail
    }
  }
}

export function loadSnapshots(ticker: string): MomentumSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ticker}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as MomentumSnapshot[];
  } catch {
    return [];
  }
}

export function clearSnapshots(ticker: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${ticker}`);
  } catch {
    // non-fatal
  }
}

// ── Analysis ──────────────────────────────────────────────────────────────────

function surgeLevelToNum(level: SurgeLevel): number {
  const map: Record<SurgeLevel, number> = { none: 0, medium: 1, high: 2, critical: 3 };
  return map[level];
}

function linearTrend(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export function analyzeMomentum(ticker: string): MomentumAnalysis {
  const now = Date.now();
  const all = loadSnapshots(ticker);
  const snapshots = all.filter((s) => now - s.timestamp < MAX_AGE_MS);

  if (snapshots.length < 3) {
    return {
      direction: 'sideways',
      confidence: 0,
      summary: '데이터 부족 (최소 3회 갱신 필요)',
      signalCount: 0,
      snapshotCount: snapshots.length,
    };
  }

  const window = snapshots.slice(-10);

  const changeTrend  = linearTrend(window.map((s) => s.changePercent));
  const volumeTrend  = linearTrend(window.map((s) => s.volume));
  const surgeNums    = window.map((s) => surgeLevelToNum(s.surgeLevel));
  const avgSurge     = surgeNums.reduce((a, b) => a + b, 0) / surgeNums.length;

  // Repeated breakout: price >= 99.5% of recent peak across last 3+ snapshots
  const prices    = window.map((s) => s.price);
  const maxPrice  = Math.max(...prices);
  const breakoutAttempts = prices.filter((p) => p >= maxPrice * 0.995).length;

  let accel = 0;
  let fade  = 0;

  if (changeTrend  >  0.15) accel++;
  if (changeTrend  < -0.15) fade++;
  if (volumeTrend  >  0)    accel++;
  if (volumeTrend  <  0)    fade++;
  if (avgSurge     >= 1.5)  accel++;
  if (avgSurge     <  0.5)  fade++;
  if (breakoutAttempts >= 3) accel++;

  const total      = accel + fade;
  const confidence = total === 0 ? 0 : Math.min(total / 4, 1);

  const direction: MomentumDirection =
    accel > fade ? 'accelerating' : fade > accel ? 'fading' : 'sideways';

  const summary = buildSummary(direction, changeTrend, volumeTrend, avgSurge, breakoutAttempts, snapshots.length);

  return { direction, confidence, summary, signalCount: total, snapshotCount: snapshots.length };
}

function buildSummary(
  dir: MomentumDirection,
  changeTrend: number,
  volumeTrend: number,
  avgSurge: number,
  breakouts: number,
  snapCount: number,
): string {
  if (dir === 'accelerating') {
    if (avgSurge >= 2 && breakouts >= 3) return '거래량 급증 지속 + 반복 돌파 시도 — 모멘텀 강화 중';
    if (changeTrend > 0.5)               return '가격 상승 폭 확대 중 — 모멘텀 가속';
    return '거래량·가격 동반 상승 — 모멘텀 강화 중';
  }
  if (dir === 'fading') {
    if (volumeTrend < 0) return '거래량 감소 감지 — 모멘텀 약화';
    if (changeTrend < -0.3) return '가격 상승 폭 축소 — 모멘텀 둔화';
    return '신호 약화 — 관망 필요';
  }
  return `방향성 불명확 (${snapCount}회 관측)`;
}
