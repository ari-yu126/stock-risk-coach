/**
 * KIS Open API Provider — PLACEHOLDER (not implemented)
 *
 * This file documents the intended replacement for naverFinanceProvider.ts.
 * KIS (Korea Investment & Securities) Open API provides an official, stable,
 * rate-limit-documented data feed for Korean market data.
 *
 * API documentation: https://apiportal.koreainvestment.com/
 * OAuth2 token endpoint: https://openapi.koreainvestment.com:9443/oauth2/tokenP
 *
 * Required environment variables (add to .env.local.example when implemented):
 *   KIS_APP_KEY=
 *   KIS_APP_SECRET=
 *   KIS_ACCOUNT_NO=           # trading account — NOT needed for quote-only use
 *   KIS_ENVIRONMENT=real      # "real" | "mock" (KIS sandbox)
 *
 * Key endpoints this provider would call:
 *
 *   GET /uapi/domestic-stock/v1/quotations/inquire-price
 *     → real-time price, changePercent, volume
 *     → tr_id: FHKST01010100 (KOSPI/KOSDAQ)
 *
 *   GET /uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice
 *     → historical daily price + volume (for 20-day avgVolume calculation)
 *     → tr_id: FHKST03010100
 *
 *   GET /uapi/domestic-stock/v1/quotations/inquire-price-2
 *     → marketCap, tradingValue, stockExchangeType
 *
 * Fields that would become REAL (no longer approximated):
 *   - avgVolume:          derived from 20-day history endpoint
 *   - sector:             KRX sector classification (tr_id: FHPST02300000)
 *   - marketCapBillion:   returned directly in price-2 endpoint
 *
 * Implementation notes:
 *   - OAuth2 access tokens expire every 24 hours; cache server-side.
 *   - Rate limit: 20 requests/second per app key (as of 2025).
 *   - Domestic stocks only; KOSPI/KOSDAQ included, ELW/ETN excluded.
 *   - Do NOT implement order/trading endpoints in this app (read-only usage).
 *
 * To activate:
 *   1. Register at https://apiportal.koreainvestment.com/
 *   2. Create an app and get APP_KEY + APP_SECRET.
 *   3. Implement this provider following the MarketDataProvider interface.
 *   4. Update getMarketDataProvider.ts to return kisProvider when env vars present.
 */

// Intentionally empty — implementation deferred.
// The placeholder below shows the intended shape.

// import type { MarketDataProvider } from './types';
//
// export const kisProvider: MarketDataProvider = {
//   async fetchStocks(query) {
//     // 1. Get or refresh OAuth2 token
//     // 2. Fetch real-time quotes for TRACKED_TICKERS in batches
//     // 3. Fetch 20-day history to compute avgVolume
//     // 4. Normalize to MarketStock[]
//     throw new Error('kisProvider: not implemented');
//   },
// };

export {};
