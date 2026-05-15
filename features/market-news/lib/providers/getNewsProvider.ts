import { naverNewsProvider } from './naverNewsProvider';
import { mockNewsProvider } from './mockNewsProvider';
import type { NewsProvider } from './types';

interface ResolvedProvider {
  provider: NewsProvider;
  providerType: 'naver' | 'mock';
}

export function getNewsProvider(): ResolvedProvider {
  const ready =
    Boolean(process.env.NAVER_CLIENT_ID) &&
    Boolean(process.env.NAVER_CLIENT_SECRET);

  return ready
    ? { provider: naverNewsProvider, providerType: 'naver' }
    : { provider: mockNewsProvider, providerType: 'mock' };
}
