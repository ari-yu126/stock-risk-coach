import { Stock, RiskScore, RiskLevel, AttentionLevel, PriceRange } from '../types';

// ── Sector base risk ──────────────────────────────────────────────────────────
// Scores represent structural sector risk independent of daily price/volume moves.
// Sources: naverFinanceProvider (live KRX labels) + watchlist mock-data (legacy labels).

const SECTOR_BASE_RISK: Record<string, number> = {
  // Live KRX labels returned by naverFinanceProvider / mockMarketDataProvider
  '금융':    0,  // regulated, stable
  '조선':    3,  // cyclical, industrial
  '자동차':  3,  // steady demand, moderate swings
  '반도체':  7,  // cycle-sensitive, theme-driven surges
  '플랫폼':  5,  // regulatory overhang
  '바이오':  8,  // clinical + regulatory uncertainty
  '로봇':    8,  // speculative, early-stage theme
  '2차전지': 10, // high speculation, policy-sensitive
  '기타':    5,  // unknown sector from live provider

};

/** Returns the base risk score for a stock's sector, with a console.warn on unknown sectors. */
export function getSectorBaseRisk(stock: Stock): number {
  const base = SECTOR_BASE_RISK[stock.sector];
  if (base === undefined) {
    console.warn('[scoring] unknown sector — using default 5', {
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
    });
    return 5;
  }
  return base;
}

// Take-profit target band expressed as [low%, high%] above current price.
// Wider band = higher uncertainty = higher risk.
const TAKE_PROFIT_BAND: Record<RiskLevel, [number, number]> = {
  '낮음': [0.03, 0.05],
  '보통': [0.04, 0.08],
  '높음': [0.06, 0.13],
  '위험': [0.09, 0.22],
};

// Stop-loss floor expressed as a percentage drop from current price.
const STOP_LOSS_DROP: Record<RiskLevel, number> = {
  '낮음': 0.03,
  '보통': 0.05,
  '높음': 0.08,
  '위험': 0.12,
};

function volatilityScore(changePercent: number): { score: number; reason: string | null } {
  const abs = Math.abs(changePercent);
  if (abs > 5) return { score: 50, reason: `급등락 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% — 단기 변동성 매우 높음` };
  if (abs > 3) return { score: 35, reason: `큰 가격 변동 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% — 변동성 주의` };
  if (abs > 1) return { score: 20, reason: `소폭 변동 ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%` };
  return { score: 5, reason: null };
}

function volumeScore(volume: number, avgVolume: number): { score: number; reason: string | null } {
  const ratio = volume / avgVolume;
  if (ratio > 5) return { score: 25, reason: `거래량 평균 대비 ${ratio.toFixed(1)}배 — 이상 급등 신호` };
  if (ratio > 3) return { score: 18, reason: `거래량 평균 대비 ${ratio.toFixed(1)}배 — 비정상적으로 높음` };
  if (ratio > 1.5) return { score: 10, reason: `거래량 평균 대비 ${ratio.toFixed(1)}배 — 다소 높은 편` };
  return { score: 0, reason: null };
}

function capScore(marketCapBillion: number): { score: number; reason: string | null } {
  if (marketCapBillion < 500) return { score: 15, reason: `시가총액 소형주 — 가격 변동 충격에 취약` };
  if (marketCapBillion < 2000) return { score: 10, reason: `시가총액 중소형주 — 유동성 리스크 존재` };
  if (marketCapBillion < 10000) return { score: 5, reason: null };
  return { score: 0, reason: null };
}

function sectorScore(stock: Stock): { score: number; reason: string | null } {
  const score = getSectorBaseRisk(stock);
  if (score >= 8) return { score, reason: `${stock.sector} 섹터 — 변동성·불확실성 높음` };
  return { score, reason: null };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 76) return '위험';
  if (score >= 51) return '높음';
  if (score >= 26) return '보통';
  return '낮음';
}

function calcAttentionLevel(stock: Stock): { level: AttentionLevel; reason: string } {
  const ratio = stock.volume / stock.avgVolume;
  const absChange = Math.abs(stock.changePercent);

  if (ratio > 5 || (ratio > 3 && absChange > 3)) {
    return { level: '위험신호', reason: `거래량 급등(${ratio.toFixed(1)}배)과 가격 변동 동시 감지` };
  }
  if (ratio > 3 || absChange > 5) {
    return {
      level: '경계',
      reason: ratio > 3
        ? `거래량 ${ratio.toFixed(1)}배 급증 — 세력 개입 가능성`
        : `가격 변동 ${absChange.toFixed(1)}% 초과 — 강한 단기 움직임`,
    };
  }
  if (ratio > 1.5 || absChange > 3) {
    return {
      level: '주의',
      reason: ratio > 1.5
        ? `거래량 평균보다 높은 수준 — 관심 유입 중`
        : `가격 변동 ${absChange.toFixed(1)}% — 주의 구간 진입`,
    };
  }
  return { level: '관찰중', reason: '특이 신호 없음 — 안정적인 흐름' };
}

function calcTakeProfitRange(price: number, level: RiskLevel): PriceRange {
  const [lo, hi] = TAKE_PROFIT_BAND[level];
  return {
    low: Math.round(price * (1 + lo)),
    high: Math.round(price * (1 + hi)),
  };
}

function calcStopLossLevel(price: number, level: RiskLevel): number {
  return Math.round(price * (1 - STOP_LOSS_DROP[level]));
}

export function calculateRisk(stock: Stock): RiskScore {
  const vol = volatilityScore(stock.changePercent);
  const volu = volumeScore(stock.volume, stock.avgVolume);
  const cap = capScore(stock.marketCapBillion);
  const sec = sectorScore(stock);

  const raw = vol.score + volu.score + cap.score + sec.score;
  const score = Math.min(100, raw);
  const level = scoreToLevel(score);

  const reasons = [vol.reason, volu.reason, cap.reason, sec.reason].filter(
    (r): r is string => r !== null
  );
  if (reasons.length === 0) reasons.push('전반적으로 안정적인 구간');

  const { level: attentionLevel, reason: attentionReason } = calcAttentionLevel(stock);

  return {
    score,
    level,
    reasons,
    attentionLevel,
    attentionReason,
    estimatedTakeProfitRange: calcTakeProfitRange(stock.price, level),
    estimatedStopLossLevel: calcStopLossLevel(stock.price, level),
  };
}
