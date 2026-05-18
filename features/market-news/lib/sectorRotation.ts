import type { StockCandidate } from './candidateDiscovery';

export interface SectorMetrics {
  sector: string;
  candidateCount: number;
  avgVolumeRatio: number;
  avgChangePercent: number;
  avgStrengthScore: number;
  dominantTheme: string;
}

export interface SectorRotationResult {
  leadingSectors: SectorMetrics[];
  weakeningSectors: SectorMetrics[];
  rotationSummary: string;
  allSectors: SectorMetrics[];
}

export function analyzeSectorRotation(candidates: StockCandidate[]): SectorRotationResult {
  if (candidates.length === 0) {
    return {
      leadingSectors: [],
      weakeningSectors: [],
      rotationSummary: '분석 데이터 부족',
      allSectors: [],
    };
  }

  const sectorMap = new Map<string, StockCandidate[]>();
  for (const c of candidates) {
    const s = c.stock.sector;
    if (!sectorMap.has(s)) sectorMap.set(s, []);
    sectorMap.get(s)!.push(c);
  }

  const allSectors: SectorMetrics[] = [...sectorMap.entries()].map(([sector, cs]) => {
    const avgVolumeRatio    = cs.reduce((s, c) => s + c.scoreBreakdown.volumeRatio, 0) / cs.length;
    const avgChangePercent  = cs.reduce((s, c) => s + c.stock.changePercent, 0) / cs.length;
    const avgStrengthScore  = cs.reduce((s, c) => s + c.matchedTheme.strengthScore, 0) / cs.length;

    const themeFreq = new Map<string, number>();
    for (const c of cs) {
      themeFreq.set(c.matchedTheme.name, (themeFreq.get(c.matchedTheme.name) ?? 0) + 1);
    }
    const dominantTheme =
      [...themeFreq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

    return { sector, candidateCount: cs.length, avgVolumeRatio, avgChangePercent, avgStrengthScore, dominantTheme };
  });

  // Lead score: volume weight 0.4 + positive change 0.3 + theme strength 0.003
  const scored = allSectors
    .map((s) => ({
      ...s,
      leadScore:
        s.avgVolumeRatio * 0.4 +
        Math.max(s.avgChangePercent, 0) * 0.3 +
        s.avgStrengthScore * 0.003,
    }))
    .sort((a, b) => b.leadScore - a.leadScore);

  const leadingSectors   = scored.slice(0, 2);
  const weakeningSectors = scored
    .filter((s) => s.avgChangePercent < 0 || s.avgVolumeRatio < 1.2)
    .slice(0, 2);

  const rotationSummary = buildSummary(leadingSectors, weakeningSectors, allSectors);

  return { leadingSectors, weakeningSectors, rotationSummary, allSectors };
}

function buildSummary(
  leading: SectorMetrics[],
  weakening: SectorMetrics[],
  all: SectorMetrics[],
): string {
  if (leading.length === 0) return '섹터 데이터 부족';

  const leadNames = leading.map((s) => s.sector);
  const weakNames = weakening
    .map((s) => s.sector)
    .filter((n) => !leadNames.includes(n));

  if (weakNames.length > 0 && leading[0].avgVolumeRatio > 2) {
    return `${leadNames.slice(0, 2).join(' → ')} 순환매 감지`;
  }
  if (weakNames.length > 0) {
    return `${leadNames[0]} 강세 · ${weakNames[0]} 약화`;
  }
  if (all.length === 1) {
    return `${leadNames[0]} 단독 강세`;
  }
  return `${leadNames[0]} 주도 — 광범위 상승`;
}
