import type { CommunitySentimentResponse } from '../types';
import { collectMockCommunitySentiment } from './mockCollector';

/**
 * Community data collector entry point.
 * MVP: mock generator. Phase 2: wire Naver 종토방 / DC / FM crawlers here.
 */
export async function collectCommunitySentiment(): Promise<CommunitySentimentResponse> {
  // Future: try live crawlers, fallback to mock
  return collectMockCommunitySentiment();
}
