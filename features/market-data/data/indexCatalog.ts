import type { CatalogEntry } from './stockCatalog';

// ── Index Catalog ─────────────────────────────────────────────────────────────
// Major Korean market indices. These are NOT individually-tradeable tickers.
// Tickers here are non-6-digit identifiers — the market-data provider skips them.
// Index entries are display-only: shown in search results but blocked from watchlist add.

export const INDEX_CATALOG: CatalogEntry[] = [
  { ticker: 'KOSPI',  name: 'KOSPI 지수',   marketType: '기타', type: 'index' },
  { ticker: 'KOSDAQ', name: 'KOSDAQ 지수',  marketType: '기타', type: 'index' },
  { ticker: 'KS200',  name: 'KOSPI 200',   marketType: '기타', type: 'index' },
  { ticker: 'KQ150',  name: 'KOSDAQ 150',  marketType: '기타', type: 'index' },
];
