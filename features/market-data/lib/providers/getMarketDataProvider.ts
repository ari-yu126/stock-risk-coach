import { naverFinanceProvider } from './naverFinanceProvider';
import { mockMarketDataProvider } from './mockMarketDataProvider';
import type { MarketDataProvider, MarketDataProviderType } from './types';

interface ResolvedProvider {
  provider: MarketDataProvider;
  providerType: MarketDataProviderType;
}

/**
 * Returns the active market data provider.
 *
 * Priority:
 *   1. Naver Finance (unofficial, no env vars required)
 *   2. Mock (automatic fallback — callers must catch errors from naverFinanceProvider
 *            and call getMockMarketDataProvider() or handle the fallback themselves)
 *
 * When KIS Open API credentials are available, update this function to check
 * process.env.KIS_APP_KEY / KIS_APP_SECRET and return kisProvider instead.
 * See: kisProvider.placeholder.ts
 */
export function getMarketDataProvider(): ResolvedProvider {
  return { provider: naverFinanceProvider, providerType: 'naver-finance' };
}

/** Explicit mock provider for use as fallback after naverFinanceProvider fails. */
export function getMockMarketDataProvider(): ResolvedProvider {
  return { provider: mockMarketDataProvider, providerType: 'mock' };
}
