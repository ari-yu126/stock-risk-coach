import type { TrackedSignal } from './signalTrackingTypes';

const STORAGE_KEY = 'stock-risk-coach.signal-tracking.v1';

export const SIGNAL_TRACKING_UPDATED_EVENT = 'stock-risk-coach.signal-tracking-updated';

export function loadTrackedSignals(): TrackedSignal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as TrackedSignal[];
  } catch {
    return [];
  }
}

export function saveTrackedSignals(signals: TrackedSignal[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(signals));
    window.dispatchEvent(new CustomEvent(SIGNAL_TRACKING_UPDATED_EVENT));
  } catch {
    // non-fatal
  }
}
