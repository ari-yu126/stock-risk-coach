import type { EntrySignalResult } from './entrySignalTypes';
import type { TrackedSignal } from './signalTrackingTypes';
import { loadTrackedSignals, saveTrackedSignals } from './signalLogStore';

/** KST calendar date YYYY-MM-DD */
export function toKstDate(iso: string | number): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

/**
 * Persist entry-ready signals once per ticker/strategy/day.
 */
export function captureEntrySignals(
  signals: EntrySignalResult[],
  priceByTicker: Map<string, number>,
  fetchedAt: string,
): number {
  const existing = loadTrackedSignals();
  const keys = new Set(existing.map((s) => s.dedupeKey));
  const signalDate = toKstDate(fetchedAt);
  const added: TrackedSignal[] = [];

  for (const sig of signals) {
    if (sig.stage !== 'entry-ready' && !sig.canEnter) continue;

    const entryPrice = priceByTicker.get(sig.ticker);
    if (!entryPrice || entryPrice <= 0) continue;

    const dedupeKey = `${sig.ticker}:${sig.strategyId}:${signalDate}`;
    if (keys.has(dedupeKey)) continue;
    keys.add(dedupeKey);

    added.push({
      id: `${dedupeKey}-${Date.now()}`,
      dedupeKey,
      ticker: sig.ticker,
      name: sig.name,
      strategyId: sig.strategyId,
      strategyName: sig.strategyName,
      stage: sig.stage,
      entryScore: sig.entryScore,
      entryPrice,
      signalAt: fetchedAt,
      signalDate,
      status: 'pending',
    });
  }

  if (added.length > 0) {
    saveTrackedSignals([...existing, ...added]);
  }

  return added.length;
}
