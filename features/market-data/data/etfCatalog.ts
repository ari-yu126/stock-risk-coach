import type { CatalogEntry } from './stockCatalog';

// ── ETF Catalog ───────────────────────────────────────────────────────────────
// Source: KRX official ETF listings — update periodically.
// All ETFs trade on KOSPI regardless of underlying index.
// Ticker format: 6-digit numeric, same as stocks. Naver Finance stock API handles ETFs.
//
// To add a new ETF: append an entry here. No other file changes required.

export const ETF_CATALOG: CatalogEntry[] = [
  // ── 국내 지수 추종 ─────────────────────────────────────────────────────────
  { ticker: '069500', name: 'KODEX 200',              marketType: 'KOSPI', type: 'etf' },
  { ticker: '102110', name: 'TIGER 200',              marketType: 'KOSPI', type: 'etf' },
  { ticker: '148070', name: 'KBSTAR 200',             marketType: 'KOSPI', type: 'etf' },
  { ticker: '229200', name: 'KODEX KOSDAQ150',        marketType: 'KOSPI', type: 'etf' },
  { ticker: '233740', name: 'KODEX KOSDAQ150 레버리지', marketType: 'KOSPI', type: 'etf' },

  // ── 국내 레버리지 · 인버스 ─────────────────────────────────────────────────
  { ticker: '122630', name: 'KODEX 레버리지',          marketType: 'KOSPI', type: 'etf' },
  { ticker: '114800', name: 'KODEX 인버스',            marketType: 'KOSPI', type: 'etf' },
  { ticker: '252670', name: 'KODEX 200선물인버스2X',   marketType: 'KOSPI', type: 'etf' },
  { ticker: '219905', name: 'KODEX KOSDAQ150인버스',   marketType: 'KOSPI', type: 'etf' },

  // ── 국내 섹터 ─────────────────────────────────────────────────────────────
  { ticker: '091160', name: 'KODEX 반도체',            marketType: 'KOSPI', type: 'etf' },
  { ticker: '091230', name: 'TIGER 반도체',            marketType: 'KOSPI', type: 'etf' },
  { ticker: '305720', name: 'KODEX 2차전지산업',       marketType: 'KOSPI', type: 'etf' },
  { ticker: '305540', name: 'TIGER 2차전지TOP10',      marketType: 'KOSPI', type: 'etf' },
  { ticker: '244580', name: 'KODEX 바이오',            marketType: 'KOSPI', type: 'etf' },
  { ticker: '139260', name: 'TIGER 200 IT',           marketType: 'KOSPI', type: 'etf' },
  { ticker: '266390', name: 'KODEX AI로봇공학',        marketType: 'KOSPI', type: 'etf' },
  { ticker: '364980', name: 'TIGER 차이나전기차SOLACTIVE', marketType: 'KOSPI', type: 'etf' },

  // ── 해외 지수 추종 ────────────────────────────────────────────────────────
  { ticker: '379800', name: 'KODEX 미국S&P500TR',     marketType: 'KOSPI', type: 'etf' },
  { ticker: '133690', name: 'TIGER 미국S&P500',       marketType: 'KOSPI', type: 'etf' },
  { ticker: '381180', name: 'KODEX 미국나스닥100TR',   marketType: 'KOSPI', type: 'etf' },
  { ticker: '143850', name: 'TIGER 미국나스닥100',     marketType: 'KOSPI', type: 'etf' },
  { ticker: '261240', name: 'KODEX 미국S&P500선물(H)', marketType: 'KOSPI', type: 'etf' },
  { ticker: '245340', name: 'TIGER 미국MSCI리츠',      marketType: 'KOSPI', type: 'etf' },

  // ── 배당 · 채권 ───────────────────────────────────────────────────────────
  { ticker: '385720', name: 'TIGER 미국배당다우존스',   marketType: 'KOSPI', type: 'etf' },
  { ticker: '308620', name: 'KODEX 미국채10년선물',     marketType: 'KOSPI', type: 'etf' },
  { ticker: '114260', name: 'KODEX 국채선물10년',       marketType: 'KOSPI', type: 'etf' },

  // ── HANARO · KBSTAR 주요 ETF ─────────────────────────────────────────────
  { ticker: '306530', name: 'KBSTAR 미국S&P500',      marketType: 'KOSPI', type: 'etf' },
  { ticker: '367380', name: 'KBSTAR 미국나스닥100',    marketType: 'KOSPI', type: 'etf' },
  { ticker: '428450', name: 'HANARO 미국AI반도체나스닥',marketType: 'KOSPI', type: 'etf' },
];
