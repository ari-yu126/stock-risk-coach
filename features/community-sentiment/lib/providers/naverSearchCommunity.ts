import { NAVER_SEARCH_DISPLAY } from '../config';
import {
  createFetchLog,
  searchHttpCode,
  type CommunityFetchLog,
} from '../collectDebug';
import {
  applySearchRateLimitCooldown,
  cacheSearchPostsForTicker,
  getCachedSearchPostsForTicker,
  getSearchCooldownUntil,
  isSearchSourceInCooldown,
  type SearchCacheSource,
} from '../searchSourceCache';
import { stripHtml } from '../textUtils';
import { keywordSentimentAnalyzer } from '../sentimentAnalyzer';
import type { CommunityPost, CommunitySource } from '../../types';

interface NaverSearchItem {
  title: string;
  description?: string;
  link: string;
  pubDate?: string;
}

interface NaverSearchResponse {
  items?: NaverSearchItem[];
  errorMessage?: string;
  errorCode?: string;
}

export interface SearchFetchResult {
  posts: CommunityPost[];
  logs: CommunityFetchLog[];
}

function hasNaverSearchCredentials(): boolean {
  return Boolean(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
}

function itemsToPosts(
  items: NaverSearchItem[],
  ticker: string,
  postSource: CommunitySource,
): CommunityPost[] {
  const now = Date.now();
  const cutoff = now - 24 * 3_600_000;
  const posts: CommunityPost[] = [];

  for (const item of items) {
    const publishedAt = item.pubDate ? new Date(item.pubDate).toISOString() : new Date(now).toISOString();
    if (new Date(publishedAt).getTime() < cutoff) continue;

    const title = stripHtml(item.title);
    const desc = stripHtml(item.description ?? '');
    const analyzed = keywordSentimentAnalyzer.analyze(`${title} ${desc}`);

    posts.push({
      id: `${postSource}-${ticker}-${item.link}`,
      source: postSource,
      ticker,
      title: title.slice(0, 120),
      commentCount: 1,
      positiveHits: analyzed.positiveHits,
      negativeHits: analyzed.negativeHits,
      trendHits: analyzed.trendHits,
      sentiment: analyzed.sentiment,
      sentimentScore: analyzed.score,
      publishedAt,
    });
  }

  return posts;
}

async function searchNaverWeb(
  query: string,
  ticker: string,
  logSource: SearchCacheSource,
  postSource: CommunitySource,
): Promise<{ posts: CommunityPost[]; log: CommunityFetchLog }> {
  const started = Date.now();

  if (isSearchSourceInCooldown(logSource)) {
    const cached = getCachedSearchPostsForTicker(logSource, ticker);
    const until = getSearchCooldownUntil(logSource);
    return {
      posts: cached,
      log: createFetchLog({
        source: logSource,
        code: cached.length > 0 ? 'SOURCE_COOLDOWN_SKIP' : 'SOURCE_UNAVAILABLE',
        message: cached.length > 0
          ? `cooldown until ${until ?? '?'} · cache ${cached.length} posts`
          : `cooldown until ${until ?? '?'} · no cache`,
        ticker,
        responseCount: cached.length,
        durationMs: Date.now() - started,
      }),
    };
  }

  const url = new URL('https://openapi.naver.com/v1/search/webkr.json');
  url.searchParams.set('query', query);
  url.searchParams.set('display', String(NAVER_SEARCH_DISPLAY));
  url.searchParams.set('sort', 'date');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID ?? '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET ?? '',
      },
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cached = getCachedSearchPostsForTicker(logSource, ticker);
    return {
      posts: cached,
      log: createFetchLog({
        source: logSource,
        code: 'SEARCH_API_FETCH_FAILED',
        message: `query="${query}" ${message}${cached.length ? ' · cache used' : ''}`,
        ticker,
        responseCount: cached.length,
        durationMs: Date.now() - started,
      }),
    };
  }

  const durationMs = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const code = searchHttpCode(res.status);

    if (res.status === 429) {
      applySearchRateLimitCooldown(logSource);
      const cached = getCachedSearchPostsForTicker(logSource, ticker);
      return {
        posts: cached,
        log: createFetchLog({
          source: logSource,
          code: 'SEARCH_API_429',
          message: `no retry · cooldown 10m${cached.length ? ` · cache ${cached.length}` : ' · unavailable'}`,
          ticker,
          httpStatus: 429,
          responseCount: cached.length,
          durationMs,
        }),
      };
    }

    const cached = getCachedSearchPostsForTicker(logSource, ticker);
    return {
      posts: cached,
      log: createFetchLog({
        source: logSource,
        code,
        message: (body.slice(0, 200) || res.statusText) + (cached.length ? ' · cache used' : ''),
        ticker,
        httpStatus: res.status,
        responseCount: cached.length,
        durationMs,
      }),
    };
  }

  let data: NaverSearchResponse;
  try {
    data = (await res.json()) as NaverSearchResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const cached = getCachedSearchPostsForTicker(logSource, ticker);
    return {
      posts: cached,
      log: createFetchLog({
        source: logSource,
        code: 'SEARCH_API_JSON_PARSE_ERROR',
        message: message + (cached.length ? ' · cache used' : ''),
        ticker,
        httpStatus: res.status,
        responseCount: cached.length,
        durationMs,
      }),
    };
  }

  if (data.errorCode || data.errorMessage) {
    const is401 = data.errorCode === '024' || String(data.errorMessage).includes('Authentication');
    const cached = getCachedSearchPostsForTicker(logSource, ticker);
    return {
      posts: cached,
      log: createFetchLog({
        source: logSource,
        code: is401 ? 'SEARCH_API_401' : 'SEARCH_API_HTTP_ERROR',
        message: `${data.errorCode ?? ''} ${data.errorMessage ?? ''}`.trim(),
        ticker,
        httpStatus: res.status,
        responseCount: cached.length,
        durationMs,
      }),
    };
  }

  const items = data.items ?? [];
  const posts = itemsToPosts(items, ticker, postSource);

  if (posts.length > 0) {
    cacheSearchPostsForTicker(logSource, ticker, posts);
  }

  return {
    posts,
    log: createFetchLog({
      source: logSource,
      code: posts.length > 0 ? 'OK' : 'SEARCH_API_EMPTY_RESPONSE',
      message:
        posts.length > 0
          ? `query="${query}" raw=${items.length} filtered=${posts.length}`
          : `query="${query}" raw=${items.length} none within 24h`,
      ticker,
      httpStatus: res.status,
      responseCount: posts.length,
      durationMs,
    }),
  };
}

export async function fetchNaverProxyCommunityPosts(
  ticker: string,
  stockName: string,
): Promise<SearchFetchResult> {
  if (!hasNaverSearchCredentials()) {
    const log = createFetchLog({
      source: 'collector',
      code: 'SEARCH_API_SKIPPED',
      message: 'NAVER_CLIENT_ID or NAVER_CLIENT_SECRET missing',
      ticker,
      durationMs: 0,
    });
    return { posts: [], logs: [log] };
  }

  const dc = await searchNaverWeb(
    `${stockName} 디시인사이드`,
    ticker,
    'naver-search-dc',
    'dc-stock',
  );
  const fm = await searchNaverWeb(
    `${stockName} 에펨코리아`,
    ticker,
    'naver-search-fm',
    'fmkorea-stock',
  );

  return {
    posts: [...dc.posts, ...fm.posts],
    logs: [dc.log, fm.log],
  };
}

export function isNaverSearchAvailable(): boolean {
  return hasNaverSearchCredentials();
}
