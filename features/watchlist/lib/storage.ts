import { DEFAULT_WATCHLIST_TICKERS } from './mock-data';

const STORAGE_KEY = 'stock-risk-coach.watchlist.v1';

/**
 * Reads persisted tickers from localStorage.
 * - Key absent / null  → first visit  → DEFAULT_WATCHLIST_TICKERS
 * - Key present, valid array           → stored array (may be empty — intentional clear)
 * - Key present, invalid JSON          → DEFAULT_WATCHLIST_TICKERS
 * - Key present, non-array JSON        → DEFAULT_WATCHLIST_TICKERS
 * Must only be called client-side (inside useEffect or event handlers).
 */
export function loadTickers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_WATCHLIST_TICKERS;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_WATCHLIST_TICKERS;

    return parsed.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    );
  } catch {
    return DEFAULT_WATCHLIST_TICKERS;
  }
}

/**
 * Persists tickers to localStorage.
 * Silently swallows errors (private mode, storage quota exceeded, etc.).
 */
export function saveTickers(tickers: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
  } catch {
    // Intentionally swallowed — localStorage unavailability is non-fatal.
  }
}
