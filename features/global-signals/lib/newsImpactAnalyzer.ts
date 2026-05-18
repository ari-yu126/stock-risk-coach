import type { SignalImpact } from '../types';
import type { SectorMapping } from './sectorMappings';
import { SECTOR_MAPPINGS } from './sectorMappings';

// ── Impact keyword lists ──────────────────────────────────────────────────────
// Checked via substring match on lowercased title + summary.

const POSITIVE_KEYWORDS = [
  'record revenue', 'beat expectations', 'earnings beat', 'revenue beat',
  'raises guidance', 'raised guidance', 'surging demand', 'strong demand',
  'rate cut', 'dovish', 'easing policy',
  'surge', 'rally', 'rebound', 'recover', 'gain', 'jump', 'soar', 'boom',
  'record', 'beat', 'growth', 'profit', 'outperform', 'upgrade',
  'expansion', 'optimism', 'bullish', 'upbeat', 'strong earnings',
];

const NEGATIVE_KEYWORDS = [
  'miss expectations', 'earnings miss', 'revenue miss', 'deliveries miss',
  'falls short', 'rate hike', 'rate increase', 'hawkish',
  'selloff', 'sell-off', 'market crash',
  'fall', 'drop', 'decline', 'slump', 'crash', 'plunge', 'tumble',
  'miss', 'weak', 'downturn', 'concern', 'fear',
  'downgrade', 'disappointing', 'loss', 'warning', 'slowdown',
  'recession', 'layoff', 'job cut', 'tariff', 'sanction', 'ban',
  'inflation surge',
];

// ── Sector matching ───────────────────────────────────────────────────────────

function countKeywordHits(text: string, keywords: string[]): number {
  return keywords.filter((kw) => text.includes(kw)).length;
}

function bestSector(text: string): SectorMapping | null {
  let best: SectorMapping | null = null;
  let bestScore = 0;

  for (const mapping of SECTOR_MAPPINGS) {
    const score = countKeywordHits(text, mapping.keywords);
    if (score > bestScore) {
      bestScore = score;
      best = mapping;
    }
  }

  return bestScore > 0 ? best : null;
}

// ── Impact scoring ────────────────────────────────────────────────────────────

function analyzeImpact(text: string): SignalImpact {
  // Multi-word phrases in NEGATIVE/POSITIVE lists are checked first implicitly
  // because they appear before single words — substring match handles both.
  const pos = countKeywordHits(text, POSITIVE_KEYWORDS);
  const neg = countKeywordHits(text, NEGATIVE_KEYWORDS);

  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AnalyzedSignal {
  sector: string;
  sectorLabel: string;
  relatedTickers: string[];
  impact: SignalImpact;
}

export function analyzeArticle(title: string, summary: string): AnalyzedSignal | null {
  const text = `${title} ${summary}`.toLowerCase();
  const sector = bestSector(text);
  if (!sector) return null;

  return {
    sector: sector.id,
    sectorLabel: sector.label,
    relatedTickers: sector.koreanTickers,
    impact: analyzeImpact(text),
  };
}
