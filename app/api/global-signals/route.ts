import { getGlobalNewsProvider } from '@/features/global-signals/lib/providers/getGlobalNewsProvider';
import { mockGlobalNewsProvider } from '@/features/global-signals/lib/providers/mockGlobalNewsProvider';
import { analyzeArticle } from '@/features/global-signals/lib/newsImpactAnalyzer';
import type { GlobalSignal, GlobalSignalsResponse } from '@/features/global-signals/types';
import { apiCache } from '@/lib/apiCache';

const CACHE_KEY = 'global-signals';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes — Finnhub free tier is 60 req/min; one req per TTL is well within limits
const SIGNAL_LIMIT = 20;

async function fetchFresh(): Promise<Omit<GlobalSignalsResponse, 'cacheHit' | 'cacheAgeMs'>> {
  const { provider, providerType } = getGlobalNewsProvider();
  const fetchedAt = new Date().toISOString();

  let articles;
  let fallbackReason: string | null = null;
  let actualProviderType: 'finnhub' | 'mock' = providerType;

  console.log('[global-signals] fetching fresh →', { providerType });

  try {
    articles = await provider.fetchNews();
    console.log(`[global-signals] ${providerType} → ${articles.length} articles`);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    fallbackReason = `${providerType}-error: ${msg}`;
    console.warn('[global-signals] provider failed, falling back to mock:', msg);
    articles = await mockGlobalNewsProvider.fetchNews();
    actualProviderType = 'mock';
  }

  const signals: GlobalSignal[] = [];
  const seenIds = new Set<string>();

  for (const article of articles) {
    if (seenIds.has(article.id)) continue;
    seenIds.add(article.id);

    const analyzed = analyzeArticle(article.title, article.summary);
    if (!analyzed) continue;

    signals.push({
      id: article.id,
      title: article.title,
      summary: article.summary.length > 220 ? `${article.summary.slice(0, 217)}...` : article.summary,
      source: article.source,
      sector: analyzed.sector,
      sectorLabel: analyzed.sectorLabel,
      relatedTickers: analyzed.relatedTickers,
      impact: analyzed.impact,
      publishedAt: article.publishedAt,
    });
  }

  signals.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  console.log(`[global-signals] ${signals.length} signals classified from ${articles.length} articles`);

  return {
    signals: signals.slice(0, SIGNAL_LIMIT),
    providerType: actualProviderType,
    fetchedAt,
    fallbackReason,
  };
}

export async function GET(): Promise<Response> {
  const { data, meta } = await apiCache.fetch(CACHE_KEY, CACHE_TTL, fetchFresh);
  console.log(`[global-signals] cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'}`);
  const body: GlobalSignalsResponse = { ...data, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
  return Response.json(body);
}
