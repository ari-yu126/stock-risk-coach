export type SurgeLevel = 'none' | 'medium' | 'high' | 'critical';

export interface SurgeSignal {
  type: 'volume' | 'price' | 'combined';
  level: SurgeLevel;
  label: string;
  detail: string;
}

export interface SurgeResult {
  level: SurgeLevel;
  signals: SurgeSignal[];
  summary: string;
}

type StockInput = { volume: number; avgVolume: number; changePercent: number };

const LEVEL_ORDER: SurgeLevel[] = ['none', 'medium', 'high', 'critical'];

function maxLevel(a: SurgeLevel, b: SurgeLevel): SurgeLevel {
  return LEVEL_ORDER.indexOf(a) >= LEVEL_ORDER.indexOf(b) ? a : b;
}

export function detectSurgeSignals(stock: StockInput): SurgeResult {
  const signals: SurgeSignal[] = [];
  const volumeRatio = stock.volume / stock.avgVolume;
  const absChange = Math.abs(stock.changePercent);

  let volumeLevel: SurgeLevel = 'none';
  if (volumeRatio >= 5)      volumeLevel = 'critical';
  else if (volumeRatio >= 3) volumeLevel = 'high';
  else if (volumeRatio >= 2) volumeLevel = 'medium';

  if (volumeLevel !== 'none') {
    signals.push({
      type: 'volume',
      level: volumeLevel,
      label: '거래량 급증',
      detail: `평균 ${volumeRatio.toFixed(1)}배`,
    });
  }

  let priceLevel: SurgeLevel = 'none';
  if (absChange >= 7)      priceLevel = 'critical';
  else if (absChange >= 5) priceLevel = 'high';
  else if (absChange >= 3) priceLevel = 'medium';

  if (priceLevel !== 'none') {
    signals.push({
      type: 'price',
      level: priceLevel,
      label: '급등 감지',
      detail: `${absChange.toFixed(1)}% 변동`,
    });
  }

  if (volumeRatio >= 3 && absChange >= 5) {
    signals.push({
      type: 'combined',
      level: 'critical',
      label: '모멘텀 돌파',
      detail: `${volumeRatio.toFixed(1)}배 × ${absChange.toFixed(1)}%`,
    });
  }

  const level = signals.reduce<SurgeLevel>((acc, s) => maxLevel(acc, s.level), 'none');
  const summary = signals.map((s) => s.label).join(' · ');

  return { level, signals, summary };
}
