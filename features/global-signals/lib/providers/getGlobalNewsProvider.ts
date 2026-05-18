import { finnhubNewsProvider } from './finnhubNewsProvider';
import { mockGlobalNewsProvider } from './mockGlobalNewsProvider';
import type { GlobalNewsProvider } from './types';

interface ResolvedProvider {
  provider: GlobalNewsProvider;
  providerType: 'finnhub' | 'mock';
}

export function getGlobalNewsProvider(): ResolvedProvider {
  return process.env.FINNHUB_API_KEY
    ? { provider: finnhubNewsProvider, providerType: 'finnhub' }
    : { provider: mockGlobalNewsProvider, providerType: 'mock' };
}
