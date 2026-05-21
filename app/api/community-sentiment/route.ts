import { collectCommunitySentiment } from '@/features/community-sentiment/lib/collector';
import { COLLECT_INTERVAL_MS } from '@/features/community-sentiment/lib/config';
import type { CommunitySentimentResponse } from '@/features/community-sentiment/types';
import { apiCache } from '@/lib/apiCache';

const CACHE_KEY = 'community-sentiment';

export async function GET(): Promise<Response> {
  const { data, meta } = await apiCache.fetch(CACHE_KEY, COLLECT_INTERVAL_MS, collectCommunitySentiment);
  const body: CommunitySentimentResponse = {
    ...data,
    cacheHit: meta.hit,
    cacheAgeMs: meta.ageMs,
  };
  return Response.json(body);
}
