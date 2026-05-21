import { STOCK_CATALOG } from '../data/stockCatalog';
import { ETF_CATALOG } from '../data/etfCatalog';
import { INDEX_CATALOG } from '../data/indexCatalog';

const NAME_BY_TICKER = new Map<string, string>();

for (const entry of [...STOCK_CATALOG, ...ETF_CATALOG, ...INDEX_CATALOG]) {
  if (!NAME_BY_TICKER.has(entry.ticker)) {
    NAME_BY_TICKER.set(entry.ticker, entry.name);
  }
}

/** True when value looks like a bare ticker code, not a display name. */
function isTickerLikeName(name: string, ticker: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === ticker) return true;
  return /^\d{1,6}$/.test(trimmed);
}

/**
 * Resolves Korean display name from local KRX catalog.
 * Prefers a non-ticker `preferred` label (e.g. Naver API) when valid.
 */
export function resolveStockName(ticker: string, preferred?: string): string {
  const fromCatalog = NAME_BY_TICKER.get(ticker);
  if (preferred && !isTickerLikeName(preferred, ticker)) {
    return preferred;
  }
  if (fromCatalog) return fromCatalog;
  if (preferred?.trim()) return preferred.trim();
  return ticker;
}

export function getCatalogNameMap(): ReadonlyMap<string, string> {
  return NAME_BY_TICKER;
}
