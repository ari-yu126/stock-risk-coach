import type { MomentumSnapshot } from './momentumHistory';

export type FomoRiskLevel = 'normal' | 'elevated' | 'danger';

export interface FomoResult {
  riskLevel: FomoRiskLevel;
  reasons: string[];
  score: number;  // 0–100
}

export interface FomoInput {
  ticker: string;
  volumeRatio: number;
  changePercent: number;
  newsCount: number;
  snapshots?: MomentumSnapshot[];
}

export function detectFomo(input: FomoInput): FomoResult {
  const reasons: string[] = [];
  let score = 0;

  // Signal 1: Excessive volume
  if (input.volumeRatio >= 7) {
    reasons.push(`거래량 ${input.volumeRatio.toFixed(1)}배 — 과도한 집중`);
    score += 30;
  } else if (input.volumeRatio >= 5) {
    reasons.push(`거래량 ${input.volumeRatio.toFixed(1)}배 — 과열 징후`);
    score += 20;
  }

  // Signal 2: Excessive volatility
  const absChange = Math.abs(input.changePercent);
  if (absChange >= 10) {
    reasons.push(`${absChange.toFixed(1)}% 급등 — 변동성 극단`);
    score += 30;
  } else if (absChange >= 7) {
    reasons.push(`${absChange.toFixed(1)}% 급등 — 추격매수 위험`);
    score += 20;
  } else if (absChange >= 5) {
    reasons.push(`${absChange.toFixed(1)}% 변동 — 고점 가능성`);
    score += 10;
  }

  // Signal 3: Vertical move without pullback (from snapshot history)
  if (input.snapshots && input.snapshots.length >= 4) {
    const recent = input.snapshots.slice(-5);
    const monotonic = recent.every((s, i) => i === 0 || s.price >= recent[i - 1].price * 0.998);
    if (monotonic) {
      reasons.push('연속 상승 — 되돌림 없는 수직 상승');
      score += 20;
    }
  }

  // Signal 4: Repeated upper-tail candles (deterministic mock, refreshes hourly)
  const seed = input.ticker.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hour = Math.floor(Date.now() / 3_600_000);
  const upperTailProb = (Math.sin(seed * 0.7 + hour * 1.3) + 1) / 2;
  if (upperTailProb > 0.7) {
    reasons.push('고가 꼬리 반복 감지 (참고용)');
    score += 10;
  }

  // Signal 5: News concentration spike
  if (input.newsCount >= 6) {
    reasons.push(`뉴스 ${input.newsCount}건 집중 — 단기 과열 가능성`);
    score += 15;
  } else if (input.newsCount >= 4) {
    score += 5;
  }

  score = Math.min(score, 100);

  const riskLevel: FomoRiskLevel =
    score >= 50 ? 'danger' : score >= 25 ? 'elevated' : 'normal';

  return { riskLevel, reasons, score };
}
