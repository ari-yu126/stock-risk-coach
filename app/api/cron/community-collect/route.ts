import { collectCommunitySentiment } from '@/features/community-sentiment/lib/collector';
import { apiCache } from '@/lib/apiCache';

const CACHE_KEY = 'community-sentiment';

/**
 * Hourly collection hook — call from external cron or Vercel Cron.
 * Refreshes in-memory cache (swap apiCache backend for Redis in production).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  apiCache.invalidate(CACHE_KEY);
  const { data } = await apiCache.fetch(CACHE_KEY, Number.MAX_SAFE_INTEGER, collectCommunitySentiment);

  return Response.json({
    ok: true,
    collectedAt: data.collectedAt,
    itemCount: data.items.length,
    providerType: data.providerType,
  });
}
