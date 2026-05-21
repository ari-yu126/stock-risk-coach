import type { NextRequest } from 'next/server';
import { collectCommunitySentiment } from '@/features/community-sentiment/lib/collector';
import { COLLECT_INTERVAL_MS } from '@/features/community-sentiment/lib/config';
import type { CommunitySentimentResponse } from '@/features/community-sentiment/types';
import { apiCache } from '@/lib/apiCache';

const CACHE_KEY = 'community-sentiment';

export async function GET(request: NextRequest): Promise<Response> {
  const noCache = request.nextUrl.searchParams.get('noCache') === '1';

  if (noCache) {
    console.log('[community-sentiment] noCache=1 — bypassing cache');
    const data = await collectCommunitySentiment();
    const body: CommunitySentimentResponse = {
      ...data,
      cacheHit: false,
      cacheAgeMs: null,
      debug: data.debug
        ? { ...data.debug, cacheHit: false, cacheAgeMs: null }
        : undefined,
    };
    return Response.json(body);
  }

  const { data, meta } = await apiCache.fetch(CACHE_KEY, COLLECT_INTERVAL_MS, collectCommunitySentiment);
  const body: CommunitySentimentResponse = {
    ...data,
    cacheHit: meta.hit,
    cacheAgeMs: meta.ageMs,
    debug: data.debug
      ? { ...data.debug, cacheHit: meta.hit, cacheAgeMs: meta.ageMs }
      : undefined,
  };
  return Response.json(body);
}
