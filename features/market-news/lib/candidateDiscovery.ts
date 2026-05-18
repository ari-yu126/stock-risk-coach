import type { MarketStock } from '../../market-data/types';
import type { DetectedTheme, ThemeArticleMatch } from './themeDetection';
import { calculateRisk } from '../../watchlist/lib/scoring';
import type { RiskScore, RiskLevel, AttentionLevel } from '../../watchlist/types';
import type { RecommendationAction } from '../types';

// Reuse the same four-value label type — values are identical.
export type JudgmentLabel = RecommendationAction;

// ── Foreign-news detection ────────────────────────────────────────────────────
// Korean financial news frequently references US companies and macro events.
// These keywords identify articles where overseas market developments drove the story.

const FOREIGN_MARKET_KEYWORDS = [
  // US tech companies commonly cited in Korean sector news
  '엔비디아', 'nvidia', 'tsmc', 'amd', '인텔', 'intel',
  '마이크로소프트', 'microsoft', '애플', 'apple',
  '구글', 'google', '아마존', 'amazon', '메타', 'meta',
  '퀄컴', 'qualcomm', 'broadcom',
  // US market indices and venues
  '나스닥', '뉴욕 증시', '뉴욕증시', '미국 증시', '미 증시', 's&p',
  // US Federal Reserve / macro
  '연준', 'fomc', '파월', '미 연준', '기준금리 인상',
  // Other foreign markets
  '닛케이', '항셍', '상하이 증시',
];

export function isForeignInfluenced(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return FOREIGN_MARKET_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

// Per-component breakdown exposed so the UI can explain each score to the user.
export interface CandidateScoreBreakdown {
  // ── Static snapshot scoring (server-computed) ─────────────────────────────
  themeScore: number;   // 0–40  primary signal: how active the news theme is
  volumeScore: number;  // 0–25  unusual trading activity vs 20-day average
  priceScore: number;   // 0–15  size of today's price move (abs %)
  tvScore: number;      // 0–10  trading value in 억원 (market participation)
  riskScore: number;    // 0–10  beginner accessibility: lower risk = higher bonus
  total: number;        // 0–100 sum, clamped
  volumeRatio: number;  // raw ratio (volume / avgVolume) for display
  // ── Flow-based adjustments (client-computed, 0 until enriched) ────────────
  freshnessBonus: number;      // 0–5   fresher news → higher theme score
  momentumBonus: number;       // 0–5   accelerating momentum
  overheatPenalty: number;     // 0–15  subtracted: FOMO/overextension
  sectorLeaderBonus: number;   // 0–5   leading sector gets extra weight
  flowTotal: number;           // total after flow adjustments, clamped 0–100
}

export interface StockCandidate {
  stock: MarketStock;
  riskScore: RiskScore;
  matchedTheme: DetectedTheme;
  candidateScore: number;           // 0–100 (= scoreBreakdown.total)
  scoreBreakdown: CandidateScoreBreakdown;
  matchConfidence: number;          // 0–100: theme match quality × sector relevance
  discoveryReason: string;
  cautionReason: string;
  judgmentLabel: JudgmentLabel;
  judgmentExplanation: string;
  // ── News trace (diagnostics) ─────────────────────────────────────────────────
  matchedNewsHeadlines: string[];    // up to 3 headlines from matched theme articles
  matchedNewsSources: string[];      // sources corresponding to matchedNewsHeadlines
  matchedNewsPublishedAt: string[];  // ISO timestamps corresponding to matchedNewsHeadlines
  matchedNewsKeywords: string[];     // deduplicated keywords that fired across matched articles
  isForeignNewsInfluenced: boolean;  // any matched article references foreign market/companies
}

// ── Sector → theme-id mapping ─────────────────────────────────────────────────
// Maps market-data sector names to themeDetection IDs.
// Category-level only — no individual ticker hardcoding.
// A stock that belongs to a sector with no active theme is skipped entirely.
const SECTOR_THEME_IDS: Record<string, string[]> = {
  '반도체':  ['semiconductor', 'ai-datacenter'],
  '2차전지': ['battery'],
  '바이오':  ['bio'],
  '자동차':  ['auto'],
  '플랫폼':  ['platform', 'ai-datacenter'],
  '로봇':    ['ai-datacenter', 'semiconductor'],
  '조선':    ['market-flow'],
  '금융':    ['market-flow'],
  // Legacy watchlist sector names kept for backward compatibility
  'IT':    ['semiconductor', 'ai-datacenter', 'platform'],
  '산업재': ['auto'],
};

/**
 * Sector-theme relevance multipliers (0–1).
 * Applied to the theme's matchConfidence to derive a candidate's matchConfidence.
 * Missing entry → 1.0 (full relevance).
 *
 * AI 데이터센터 has lower relevance for indirect sectors (로봇, IT broad) because
 * the theme doesn't guarantee that specific sector stocks are primary beneficiaries.
 */
const SECTOR_THEME_RELEVANCE: Partial<Record<string, Partial<Record<string, number>>>> = {
  '로봇':   { 'ai-datacenter': 0.65, 'semiconductor': 0.6 },
  '조선':   { 'market-flow': 0.75 },
  '금융':   { 'market-flow': 0.85 },
  'IT':     { 'ai-datacenter': 0.75, 'platform': 0.8 },
  '산업재': { 'auto': 0.85 },
};

function sectorThemeRelevance(sector: string, themeId: string): number {
  return SECTOR_THEME_RELEVANCE[sector]?.[themeId] ?? 1.0;
}

const CAUTION_NOTES: Record<RiskLevel, string> = {
  '낮음': '비교적 안정적인 편이에요. 그래도 언제든 갑자기 빠질 수 있어요.',
  '보통': '어느 방향으로 갈지 확실하지 않아요. 미리 손절 기준을 정해두세요.',
  '높음': '위험한 구간이에요. 들어가기 전에 잃어도 괜찮은 금액을 먼저 정하세요.',
  '위험': '지금은 정말 위험해요. 경험이 많지 않다면 오늘은 이 종목을 패스하는 게 좋아요.',
};

// ── Score component functions ─────────────────────────────────────────────────
// Each function returns an integer point value for one scoring dimension.
// The sum of all components is clamped to [0, 100].

/**
 * volumeActivityScore — max 25 pts
 * Measures how much today's volume deviates from the 20-day average.
 * Rationale: abnormal volume often precedes or confirms a price move.
 *   ≥ 5×  →  25  extreme surge (possible manipulation / major catalyst)
 *   ≥ 3×  →  18  strong surge
 *   ≥ 2×  →  12  moderate surge
 *   ≥ 1.5× →  6  slightly elevated
 *   < 1.5× →  0  normal
 */
function volumeActivityScore(volume: number, avgVolume: number): number {
  const ratio = volume / avgVolume;
  if (ratio >= 5) return 25;
  if (ratio >= 3) return 18;
  if (ratio >= 2) return 12;
  if (ratio >= 1.5) return 6;
  return 0;
}

/**
 * priceMovementScore — max 15 pts, floor 1 pt
 * Measures magnitude of today's price change (direction-agnostic).
 * Rationale: large moves — up or down — signal active market interest.
 *   ≥ 7%  → 15
 *   ≥ 5%  → 12
 *   ≥ 3%  →  8
 *   ≥ 1%  →  4
 *   < 1%  →  1  (1-pt floor so flat stocks still participate at low weight)
 */
function priceMovementScore(changePercent: number): number {
  const abs = Math.abs(changePercent);
  if (abs >= 7) return 15;
  if (abs >= 5) return 12;
  if (abs >= 3) return 8;
  if (abs >= 1) return 4;
  return 1;
}

/**
 * tradingValueScore — max 10 pts, floor 1 pt
 * Measures total money flowing through the stock today (price × volume ÷ 100M).
 * Rationale: high 거래대금 means the move is backed by real capital, not thin volume.
 *   ≥ 3,000억 → 10
 *   ≥ 1,000억 →  7
 *   ≥   300억 →  4
 *   <   300억 →  1  (floor keeps low-cap stocks in the pool with reduced weight)
 */
function tradingValueScore(tradingValue: number): number {
  if (tradingValue >= 3000) return 10;
  if (tradingValue >= 1000) return 7;
  if (tradingValue >= 300) return 4;
  return 1;
}

/**
 * riskAccessibilityScore — max 10 pts
 * Rewards stocks whose risk level is accessible to beginner traders.
 * Rationale: even if a dangerous stock scores high on signals, beginners shouldn't
 * be nudged toward it. This component downgrades rather than disqualifies.
 *   낮음 / 보통 → 10  (beginner-friendly)
 *   높음        →  5  (caution warranted)
 *   위험        →  0  (no accessibility bonus)
 */
function riskAccessibilityScore(level: RiskLevel): number {
  if (level === '낮음' || level === '보통') return 10;
  if (level === '높음') return 5;
  return 0;
}

/**
 * calcCandidateScore — aggregates all components into a 0–100 score.
 *
 * Formula:
 *   themeScore  = round(themeStrength × 0.4)   → max 40
 *   volumeScore = volumeActivityScore(...)      → max 25
 *   priceScore  = priceMovementScore(...)       → max 15
 *   tvScore     = tradingValueScore(...)        → max 10
 *   riskBonus   = riskAccessibilityScore(...)  → max 10
 *   total       = clamp(sum, 0, 100)
 *
 * The heaviest weight (40%) is given to the news theme signal so that stocks
 * surface only when a real news catalyst exists — not purely on price action.
 */
function calcCandidateScore(
  themeStrength: number,
  stock: MarketStock,
  riskLevel: RiskLevel,
): CandidateScoreBreakdown {
  const themeScore  = Math.round(themeStrength * 0.4);
  const volumeScore = volumeActivityScore(stock.volume, stock.avgVolume);
  const priceScore  = priceMovementScore(stock.changePercent);
  const tvScore     = tradingValueScore(stock.tradingValue);
  const riskScore   = riskAccessibilityScore(riskLevel);
  const total       = Math.min(themeScore + volumeScore + priceScore + tvScore + riskScore, 100);

  return {
    themeScore,
    volumeScore,
    priceScore,
    tvScore,
    riskScore,
    total,
    volumeRatio: stock.volume / stock.avgVolume,
    // Flow fields default to 0; enriched client-side via enrichWithFlowScores()
    freshnessBonus: 0,
    momentumBonus: 0,
    overheatPenalty: 0,
    sectorLeaderBonus: 0,
    flowTotal: total,
  };
}

// ── Judgment label ────────────────────────────────────────────────────────────

function buildJudgment(
  theme: DetectedTheme,
  riskLevel: RiskLevel,
  attentionLevel: AttentionLevel,
  stock: MarketStock,
): { label: JudgmentLabel; explanation: string } {
  const volumeRatio = stock.volume / stock.avgVolume;

  // Rule 1: negative theme + high risk or extreme volume → danger
  if (theme.sentimentSummary === 'negative') {
    if (riskLevel === '위험' || riskLevel === '높음' || attentionLevel === '위험신호') {
      return {
        label: '지금 접근 위험',
        explanation: '관련 테마에서 부정적인 신호가 나왔어요. 지금은 들어가기보다 지켜보는 게 나아요.',
      };
    }
    // Rule 2: negative theme + manageable risk → wait
    return {
      label: '조금 더 지켜보기',
      explanation: '관련 테마에서 좋지 않은 소식이 있어요. 방향이 잡힐 때까지 기다려보세요.',
    };
  }

  // Rule 3: strong theme + '위험' risk → danger (even positive news can't offset extreme risk)
  if (riskLevel === '위험' && theme.strengthScore >= 50) {
    return {
      label: '지금 접근 위험',
      explanation: '테마가 강하지만 리스크가 너무 높아요. 급등 이후 급락 가능성을 염두에 두세요.',
    };
  }
  // Rule 4: attention spike (위험신호) + extreme volume surge → danger
  if (attentionLevel === '위험신호' && volumeRatio >= 5) {
    return {
      label: '지금 접근 위험',
      explanation: '거래량과 가격 변동이 극단적이에요. 고점 진입 리스크가 있어요.',
    };
  }

  // Rule 5: positive theme + accessible risk + volume rising → watch candidate
  if (theme.sentimentSummary === 'positive') {
    if (theme.strengthScore >= 40 && (riskLevel === '낮음' || riskLevel === '보통') && volumeRatio >= 1.5) {
      return {
        label: '오늘 관심 후보',
        explanation: '긍정적인 테마에서 거래량이 늘고 있어요. 오늘 눈여겨볼 만하지만 손실 가능성은 언제나 있어요.',
      };
    }
    // Rule 6: positive theme + high risk → wait for confirmation
    if (theme.strengthScore >= 40 && riskLevel === '높음') {
      return {
        label: '조금 더 지켜보기',
        explanation: '좋은 흐름이지만 리스크 수준이 높아요. 조금 더 확인하고 접근하세요.',
      };
    }
  }

  // Rule 7: weak theme signal → unclear
  if (theme.strengthScore < 30) {
    return {
      label: '방향 애매함',
      explanation: '테마 신호가 약해요. 지금은 지켜보는 게 좋아요.',
    };
  }

  // Rule 8: default (neutral theme, moderate signal)
  return {
    label: '방향 애매함',
    explanation: '지금은 어느 방향으로 갈지 잘 모르겠어요. 더 지켜보세요.',
  };
}

function buildDiscoveryReason(theme: DetectedTheme, stock: MarketStock): string {
  const parts: string[] = [`${theme.name} 테마 강도 ${theme.strengthScore}`];

  const volumeRatio = stock.volume / stock.avgVolume;
  if (volumeRatio >= 1.5) {
    parts.push(`거래량 ${volumeRatio.toFixed(1)}배 증가`);
  }

  const absChange = Math.abs(stock.changePercent);
  const dir = stock.changePercent >= 0 ? '상승' : '하락';
  parts.push(`오늘 ${dir} ${absChange.toFixed(1)}%`);

  return parts.join(' · ');
}

// ── News trace helpers ────────────────────────────────────────────────────────

function buildNewsTrace(
  themeId: string,
  traceMap: Map<string, ThemeArticleMatch[]>,
): Pick<StockCandidate, 'matchedNewsHeadlines' | 'matchedNewsSources' | 'matchedNewsPublishedAt' | 'matchedNewsKeywords' | 'isForeignNewsInfluenced'> {
  const articles = traceMap.get(themeId) ?? [];

  // Most-recent first, cap at 3 for display
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  ).slice(0, 3);

  const matchedNewsHeadlines  = sorted.map((a) => a.title);
  const matchedNewsSources    = sorted.map((a) => a.source);
  const matchedNewsPublishedAt = sorted.map((a) => a.publishedAt);

  // Deduplicated union of all keywords across every matched article (frequency-ordered)
  const kwFreq = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.matchedKeywords) {
      kwFreq.set(kw, (kwFreq.get(kw) ?? 0) + 1);
    }
  }
  const matchedNewsKeywords = [...kwFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw)
    .slice(0, 8);

  const isForeignNewsInfluenced = articles.some((a) => isForeignInfluenced(a.title, ''));

  return { matchedNewsHeadlines, matchedNewsSources, matchedNewsPublishedAt, matchedNewsKeywords, isForeignNewsInfluenced };
}

// ── Flow-based score enrichment (TASK 4) — client-side only ─────────────────
// Called after candidates are fetched, using localStorage momentum data and
// sector leadership derived from the full candidate list.

export interface FlowEnrichmentContext {
  leadingSectorNames: Set<string>;             // from sectorRotation
  momentumDirections: Map<string, 'accelerating' | 'fading' | 'sideways'>; // ticker → direction
  fomoScores: Map<string, number>;             // ticker → FOMO score 0–100
}

export function enrichWithFlowScores(
  candidates: StockCandidate[],
  ctx: FlowEnrichmentContext,
): StockCandidate[] {
  return candidates.map((c) => {
    const breakdown = { ...c.scoreBreakdown };

    // Freshness bonus: high freshnessScore = stronger theme signal
    const freshness = c.matchedTheme.freshnessScore ?? 0.5;
    breakdown.freshnessBonus = Math.round((freshness - 0.5) * 10);  // -5 to +5

    // Momentum bonus
    const dir = ctx.momentumDirections.get(c.stock.ticker);
    breakdown.momentumBonus = dir === 'accelerating' ? 5 : dir === 'fading' ? -3 : 0;

    // Overheat penalty
    const fomoScore = ctx.fomoScores.get(c.stock.ticker) ?? 0;
    breakdown.overheatPenalty = Math.round(fomoScore * 0.15);  // max 15

    // Sector leader bonus
    breakdown.sectorLeaderBonus = ctx.leadingSectorNames.has(c.stock.sector) ? 5 : 0;

    breakdown.flowTotal = Math.min(
      Math.max(
        breakdown.total +
        breakdown.freshnessBonus +
        breakdown.momentumBonus +
        breakdown.sectorLeaderBonus -
        breakdown.overheatPenalty,
        0,
      ),
      100,
    );

    return { ...c, scoreBreakdown: breakdown, candidateScore: breakdown.flowTotal };
  });
}

// ── Candidate narrative (TASK 6) ─────────────────────────────────────────────

export function generateCandidateNarrative(candidate: StockCandidate): string {
  const { stock, scoreBreakdown, matchedTheme, riskScore, matchedNewsKeywords } = candidate;
  const volumeRatio = scoreBreakdown.volumeRatio;
  const absChange = Math.abs(stock.changePercent);
  const dir = stock.changePercent >= 0 ? '상승' : '하락';
  const parts: string[] = [];

  if (volumeRatio >= 3) {
    parts.push(`거래량이 평균 대비 ${volumeRatio.toFixed(0)}배 급증했고`);
  } else if (volumeRatio >= 1.5) {
    parts.push(`거래량이 평균 대비 ${volumeRatio.toFixed(1)}배 늘어났고`);
  }

  const topKeywords = matchedNewsKeywords.slice(0, 2);
  if (topKeywords.length > 0) {
    parts.push(`${topKeywords.join('·')} 관련 뉴스가 집중되며`);
  } else {
    parts.push(`${matchedTheme.name} 테마가 활성화되며`);
  }

  if (absChange >= 5) {
    parts.push(`단기 모멘텀이 강화되고 있습니다.`);
  } else if (absChange >= 2) {
    parts.push(`${dir} ${absChange.toFixed(1)}% 움직임이 나타나고 있습니다.`);
  } else {
    parts.push(`방향성이 형성되는 초기 단계입니다.`);
  }

  if (riskScore.level === '위험' || riskScore.level === '높음') {
    parts.push(`다만 리스크 수준이 높아 신중한 접근이 필요합니다.`);
  }

  return parts.join(' ');
}

// ── Main export ───────────────────────────────────────────────────────────────

export function discoverCandidates(
  themes: DetectedTheme[],
  stocks: MarketStock[],
  traceMap: Map<string, ThemeArticleMatch[]> = new Map(),
): StockCandidate[] {
  // Build a quick lookup so matching is O(1) per stock.
  const themeById = new Map(themes.map((t) => [t.id, t]));
  const candidates: StockCandidate[] = [];

  for (const stock of stocks) {
    const themeIds = SECTOR_THEME_IDS[stock.sector] ?? [];

    // Among all theme IDs associated with this sector, pick the one with the
    // highest strengthScore that is currently active (present in today's news).
    // Stocks whose sector has no active theme are not candidates.
    const matchedTheme = themeIds
      .map((id) => themeById.get(id))
      .filter((t): t is DetectedTheme => t !== undefined)
      .sort((a, b) => b.strengthScore - a.strengthScore)[0];

    if (!matchedTheme) continue;

    // MarketStock is a structural superset of Stock — assignable without casting.
    const riskScore = calculateRisk(stock);
    const scoreBreakdown = calcCandidateScore(matchedTheme.strengthScore, stock, riskScore.level);
    const relevance = sectorThemeRelevance(stock.sector, matchedTheme.id);
    const matchConfidence = Math.round(matchedTheme.matchConfidence * relevance);

    const { label: judgmentLabel, explanation: judgmentExplanation } = buildJudgment(
      matchedTheme,
      riskScore.level,
      riskScore.attentionLevel,
      stock,
    );

    candidates.push({
      stock,
      riskScore,
      matchedTheme,
      candidateScore: scoreBreakdown.total,
      scoreBreakdown,
      matchConfidence,
      discoveryReason: buildDiscoveryReason(matchedTheme, stock),
      cautionReason: CAUTION_NOTES[riskScore.level],
      judgmentLabel,
      judgmentExplanation,
      ...buildNewsTrace(matchedTheme.id, traceMap),
    });
  }

  // Highest candidateScore first; top 5 returned.
  return candidates
    .sort((a, b) => b.candidateScore - a.candidateScore)
    .slice(0, 5);
}
