import { getNewsProvider } from '@/features/market-news/lib/providers/getNewsProvider';
import { mockNewsProvider } from '@/features/market-news/lib/providers/mockNewsProvider';
import { NaverNewsApiError } from '@/features/market-news/lib/providers/naverNewsProvider';
import type { NewsArticle, NewsResponse, QueryDiagnostic } from '@/features/market-news/lib/providers/types';
import { apiCache } from '@/lib/apiCache';

const QUERIES = ['국내 증시', '반도체', '2차전지', '바이오', 'AI 데이터센터', '자동차'];
const DISPLAY_PER_QUERY = 8;
const TOTAL_LIMIT = 20;

const CACHE_KEY = 'market-news';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Merge duplicate articles by link/title, collecting all matched keywords.
function dedup(articles: NewsArticle[]): NewsArticle[] {
  const byLink = new Map<string, NewsArticle>();
  const byTitlePrefix = new Map<string, NewsArticle>();
  const result: NewsArticle[] = [];

  for (const article of articles) {
    const link = article.link.trim();
    const titlePrefix = article.title.toLowerCase().slice(0, 40);
    const existing = (link && byLink.get(link)) ?? byTitlePrefix.get(titlePrefix);

    if (existing) {
      for (const kw of article.matchedKeywords) {
        if (!existing.matchedKeywords.includes(kw)) existing.matchedKeywords.push(kw);
      }
      continue;
    }

    const entry: NewsArticle = { ...article, matchedKeywords: [...article.matchedKeywords] };
    if (link) byLink.set(link, entry);
    byTitlePrefix.set(titlePrefix, entry);
    result.push(entry);
  }

  return result;
}

interface FetchAllResult {
  articles: NewsArticle[];
  diagnostics: QueryDiagnostic[];
}

async function fetchAll(
  provider: Awaited<ReturnType<typeof getNewsProvider>>['provider'],
  label: string,
): Promise<FetchAllResult> {
  const settled = await Promise.allSettled(
    QUERIES.map((keyword) => provider.fetchNews({ keyword, display: DISPLAY_PER_QUERY })),
  );

  const articles: NewsArticle[] = [];
  const diagnostics: QueryDiagnostic[] = [];

  for (const [i, result] of settled.entries()) {
    const keyword = QUERIES[i];

    if (result.status === 'fulfilled') {
      const count = result.value.length;
      console.log(`[market-news][${label}] "${keyword}" → ${count} articles`);
      articles.push(...result.value);
      diagnostics.push({ keyword, ok: true, count });
    } else {
      const err = result.reason;
      if (err instanceof NaverNewsApiError) {
        console.error(`[market-news][${label}] "${keyword}" → HTTP ${err.httpStatus}: ${err.errorBody.slice(0, 200)}`);
        diagnostics.push({
          keyword,
          ok: false,
          count: 0,
          httpStatus: err.httpStatus,
          errorMessage: err.errorBody.slice(0, 200),
        });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[market-news][${label}] "${keyword}" failed:`, msg.slice(0, 200));
        diagnostics.push({ keyword, ok: false, count: 0, errorMessage: msg.slice(0, 200) });
      }
    }
  }

  return { articles, diagnostics };
}

function buildBody(
  articles: NewsArticle[],
  providerType: 'naver' | 'mock',
  fallbackReason: string | null,
  queryDiagnostics: QueryDiagnostic[],
): Omit<NewsResponse, 'cacheHit' | 'cacheAgeMs'> {
  const sorted = dedup(articles)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, TOTAL_LIMIT);
  return { articles: sorted, providerType, fetchedAt: new Date().toISOString(), fallbackReason, queryDiagnostics };
}

async function fetchFresh(): Promise<Omit<NewsResponse, 'cacheHit' | 'cacheAgeMs'>> {
  const hasClientId = Boolean(process.env.NAVER_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.NAVER_CLIENT_SECRET);
  const { provider, providerType } = getNewsProvider();

  console.log('[market-news] fetching fresh →', { hasClientId, hasClientSecret, providerType });

  if (providerType === 'mock') {
    const fallbackReason = 'no-credentials: NAVER_CLIENT_ID or NAVER_CLIENT_SECRET not set in env';
    console.warn(`[market-news] serving mock — ${fallbackReason}`);
    const { articles, diagnostics } = await fetchAll(provider, 'mock');
    return buildBody(articles, 'mock', fallbackReason, diagnostics);
  }

  const { articles, diagnostics } = await fetchAll(provider, 'naver');
  console.log(`[market-news] naver total: ${articles.length} articles`);

  if (articles.length === 0) {
    const failedDiag = diagnostics.find((d) => !d.ok);
    const hint = failedDiag?.httpStatus
      ? `first failure: HTTP ${failedDiag.httpStatus}`
      : 'all queries returned empty';
    const fallbackReason = `naver-returned-0: ${hint} — see queryDiagnostics for detail`;
    console.warn(`[market-news] ${fallbackReason}`);
    const { articles: mockArticles, diagnostics: mockDiag } = await fetchAll(mockNewsProvider, 'mock-fallback');
    return buildBody(mockArticles, 'mock', fallbackReason, [...diagnostics, ...mockDiag]);
  }

  return buildBody(articles, 'naver', null, diagnostics);
}

export async function GET(): Promise<Response> {
  const { data, meta } = await apiCache.fetch(CACHE_KEY, CACHE_TTL, fetchFresh);
  console.log(`[market-news] cache ${meta.hit ? `HIT (age ${meta.ageMs}ms)` : 'MISS'}`);
  const body: NewsResponse = { ...data, cacheHit: meta.hit, cacheAgeMs: meta.ageMs };
  return Response.json(body);
}
