import { DISCUSS_PAGE_SIZE } from '../config';
import {
  createFetchLog,
  discussHttpCode,
  type CommunityFetchLog,
} from '../collectDebug';
import { keywordSentimentAnalyzer } from '../sentimentAnalyzer';
import type { CommunityPost } from '../../types';

interface NaverDiscussPost {
  id: string;
  title?: string;
  contentSwReplaced?: string;
  writtenAt?: string;
  recommendCount?: number;
  notRecommendCount?: number;
}

interface NaverDiscussResponse {
  isSuccess?: boolean;
  detailCode?: string;
  message?: string;
  result?: { posts?: NaverDiscussPost[] };
}

const DISCUSS_URL = 'https://m.stock.naver.com/front-api/discussion/list';

export interface DiscussFetchResult {
  posts: CommunityPost[];
  log: CommunityFetchLog;
}

export async function fetchNaverDiscussPosts(ticker: string): Promise<DiscussFetchResult> {
  const started = Date.now();
  const url = new URL(DISCUSS_URL);
  url.searchParams.set('discussionType', 'domesticStock');
  url.searchParams.set('itemCode', ticker);
  url.searchParams.set('pageSize', String(DISCUSS_PAGE_SIZE));
  url.searchParams.set('page', '1');

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'stock-risk-coach/1.0',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: 'NAVER_DISCUSS_FETCH_FAILED',
        message: `fetch failed: ${message}`,
        ticker,
        durationMs: Date.now() - started,
      }),
    };
  }

  const durationMs = Date.now() - started;

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: discussHttpCode(res.status),
        message: body.slice(0, 200) || res.statusText,
        ticker,
        httpStatus: res.status,
        responseCount: 0,
        durationMs,
      }),
    };
  }

  let data: NaverDiscussResponse;
  try {
    data = (await res.json()) as NaverDiscussResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: 'NAVER_DISCUSS_JSON_PARSE_ERROR',
        message,
        ticker,
        httpStatus: res.status,
        durationMs,
      }),
    };
  }

  if (!data.isSuccess) {
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: 'NAVER_DISCUSS_API_REJECTED',
        message: `${data.detailCode ?? ''} ${data.message ?? ''}`.trim() || 'isSuccess=false',
        ticker,
        httpStatus: res.status,
        responseCount: 0,
        durationMs,
      }),
    };
  }

  const rawPosts = data.result?.posts ?? [];
  if (rawPosts.length === 0) {
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: 'NAVER_DISCUSS_EMPTY_RESPONSE',
        message: 'result.posts is empty',
        ticker,
        httpStatus: res.status,
        responseCount: 0,
        durationMs,
      }),
    };
  }

  const now = Date.now();
  const cutoff = now - 24 * 3_600_000;

  const posts = rawPosts
    .filter((p) => p.writtenAt && new Date(p.writtenAt).getTime() >= cutoff)
    .map((p) => {
      const text = `${p.title ?? ''} ${p.contentSwReplaced ?? ''}`;
      const analyzed = keywordSentimentAnalyzer.analyze(text);
      const engagement = Math.max(1, (p.recommendCount ?? 0) + Math.floor((p.notRecommendCount ?? 0) * 0.3));

      return {
        id: `naver-jongto-${p.id}`,
        source: 'naver-jongto' as const,
        ticker,
        title: (p.title ?? '').slice(0, 120),
        commentCount: engagement,
        positiveHits: analyzed.positiveHits,
        negativeHits: analyzed.negativeHits,
        trendHits: analyzed.trendHits,
        sentiment: analyzed.sentiment,
        sentimentScore: analyzed.score,
        publishedAt: new Date(p.writtenAt!).toISOString(),
      };
    });

  if (posts.length === 0) {
    return {
      posts: [],
      log: createFetchLog({
        source: 'naver-jongto',
        code: 'NAVER_DISCUSS_FILTERED_EMPTY',
        message: `raw=${rawPosts.length} posts, none within 24h`,
        ticker,
        httpStatus: res.status,
        responseCount: 0,
        durationMs,
      }),
    };
  }

  return {
    posts,
    log: createFetchLog({
      source: 'naver-jongto',
      code: 'OK',
      message: `raw=${rawPosts.length} filtered=${posts.length}`,
      ticker,
      httpStatus: res.status,
      responseCount: posts.length,
      durationMs,
    }),
  };
}
