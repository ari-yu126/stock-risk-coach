import { getCatalogEntry } from '@/features/market-data/data/stockCatalog';
import { resolveStockName } from '@/features/market-data/lib/resolveStockName';
import { getMarketDataProvider, getMockMarketDataProvider } from '@/features/market-data/lib/providers/getMarketDataProvider';
import type { MarketStock } from '@/features/market-data/types';
import { COLLECT_INTERVAL_MS, COMMUNITY_TRACK_TICKERS } from './config';
import type { CommunityCollectCode } from './collectCodes';
import {
  createFetchLog,
  type CommunityCollectDebug,
  type CommunityCollectSummary,
  type CommunityFetchLog,
} from './collectDebug';
import {
  buildSourceStatuses,
  collectWarningCodes,
  evaluateCollectOutcome,
} from './sourceStatus';
import {
  buildAiSummary,
  calcCommentSentimentRatios,
  calcCommunityScore,
  calcRiskLevel,
  calcTrendKeywordScore,
  calcWeightedSentimentScore,
} from './communityScore';
import { buildHourlyFromPosts, calcMentionGrowth } from './buildHourlyFromPosts';
import { fetchNaverDiscussPosts } from './providers/naverDiscuss';
import { fetchNaverProxyCommunityPosts, isNaverSearchAvailable } from './providers/naverSearchCommunity';
import type { CommunityPost, CommunitySentimentResponse, CommunityStockItem } from '../types';

function groupBySource(posts: CommunityPost[]) {
  const map = new Map<CommunityPost['source'], CommunityPost[]>();
  for (const p of posts) {
    const list = map.get(p.source) ?? [];
    list.push(p);
    map.set(p.source, list);
  }
  return map;
}

async function fetchMarketStocks(
  tickers: string[],
  logs: CommunityFetchLog[],
): Promise<Map<string, MarketStock>> {
  const started = Date.now();
  const map = new Map<string, MarketStock>();
  try {
    const { provider } = getMarketDataProvider();
    const stocks = await provider.fetchStocks({ tickers });
    for (const s of stocks) map.set(s.ticker, s);
    logs.push(
      createFetchLog({
        source: 'market-data',
        code: 'MARKET_DATA_LIVE_OK',
        message: `fetched ${stocks.length}/${tickers.length} tickers`,
        responseCount: stocks.length,
        durationMs: Date.now() - started,
      }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(
      createFetchLog({
        source: 'market-data',
        code: 'MARKET_DATA_FETCH_FAILED',
        message,
        durationMs: Date.now() - started,
      }),
    );
    try {
      const { provider } = getMockMarketDataProvider();
      const stocks = await provider.fetchStocks({ tickers });
      for (const s of stocks) map.set(s.ticker, s);
      logs.push(
        createFetchLog({
          source: 'market-data',
          code: 'MARKET_DATA_FALLBACK_MOCK',
          message: `mock ${stocks.length} tickers`,
          responseCount: stocks.length,
          durationMs: Date.now() - started,
        }),
      );
    } catch (mockErr) {
      const mockMsg = mockErr instanceof Error ? mockErr.message : String(mockErr);
      logs.push(
        createFetchLog({
          source: 'market-data',
          code: 'MARKET_DATA_FETCH_FAILED',
          message: `mock also failed: ${mockMsg}`,
          durationMs: Date.now() - started,
        }),
      );
    }
  }
  return map;
}

function buildItem(
  ticker: string,
  posts: CommunityPost[],
  market: MarketStock | undefined,
): CommunityStockItem | null {
  if (posts.length === 0) return null;

  const catalog = getCatalogEntry(ticker);
  const name = resolveStockName(ticker, market?.name ?? catalog?.name);
  const sector = market?.sector ?? '기타';
  const priceChg = market?.changePercent ?? 0;
  const volumeGrowth =
    market && market.avgVolume > 0 ? market.volume / market.avgVolume : 1;

  const bySource = groupBySource(posts);
  const mentionCount = posts.length;
  const mentionGrowth = calcMentionGrowth(posts);
  const allTrend = posts.flatMap((p) => p.trendHits);
  const trendKeywordScore = calcTrendKeywordScore(allTrend);
  const sentimentScore = calcWeightedSentimentScore(posts, bySource);

  const { positiveRatio, negativeRatio, neutralRatio } = calcCommentSentimentRatios(posts);
  const communityScore = calcCommunityScore({
    sentimentScore,
    mentionGrowth,
    volumeGrowth,
    trendKeywordScore,
  });

  const hourly = buildHourlyFromPosts(posts, volumeGrowth);
  const hourOverHourChange =
    hourly.length >= 2
      ? communityScore - Math.round(communityScore * (hourly[hourly.length - 2].sentimentScore / 100))
      : 0;

  const riskLevel = calcRiskLevel({
    mentionGrowth,
    negativeRatio,
    volumeGrowth,
    priceChangePercent: priceChg,
    hourly,
    mentionCount,
  });

  const fomoHigh = mentionGrowth >= 2.2 && volumeGrowth >= 3 && sentimentScore >= 55;
  const overheatWarning = volumeGrowth >= 4 || (mentionGrowth >= 2.5 && priceChg > 6);

  return {
    ticker,
    name,
    sector,
    communityScore,
    sentimentScore,
    mentionGrowth,
    volumeGrowth,
    trendKeywordScore,
    mentionCount,
    mentionGrowthPercent: Math.round((mentionGrowth - 1) * 100),
    positiveRatio,
    negativeRatio,
    neutralRatio,
    volumeGrowthPercent: Math.round((volumeGrowth - 1) * 100),
    trendKeywords: [...new Set(allTrend)].slice(0, 5),
    riskLevel,
    changeDirection:
      hourOverHourChange > 2 ? 'up' : hourOverHourChange < -2 ? 'down' : 'flat',
    hourOverHourChange,
    fomoHigh,
    overheatWarning,
    aiSummary: buildAiSummary([...new Set(allTrend)], sentimentScore, mentionGrowth),
    hourly,
    priceChangePercent: priceChg,
  };
}

function buildSummary(
  tickers: string[],
  items: CommunityStockItem[],
  allPosts: CommunityPost[],
): CommunityCollectSummary {
  const discussPosts = allPosts.filter((p) => p.source === 'naver-jongto').length;
  const searchDcPosts = allPosts.filter((p) => p.source === 'dc-stock').length;
  const searchFmPosts = allPosts.filter((p) => p.source === 'fmkorea-stock').length;
  return {
    tickersRequested: tickers.length,
    tickersWithData: items.length,
    discussPosts,
    searchDcPosts,
    searchFmPosts,
    totalPosts: allPosts.length,
  };
}

function buildSourcesNote(searchAvailable: boolean, warnings: CommunityCollectCode[]): string {
  const base = searchAvailable
    ? '네이버 종목토론방 + 실시간 시세 (검색은 보조)'
    : '네이버 종목토론방 + 실시간 시세';
  if (warnings.length === 0) return base;
  return `${base} · 보조 source 경고 ${warnings.length}건`;
}

export interface LiveCollectResult {
  response: CommunitySentimentResponse;
  logs: CommunityFetchLog[];
  summary: CommunityCollectSummary;
  canLive: boolean;
  fallbackReason?: string;
  sourceStatuses: ReturnType<typeof buildSourceStatuses>;
  warnings: CommunityCollectCode[];
}

export async function collectLiveCommunitySentiment(): Promise<LiveCollectResult> {
  const now = Date.now();
  const tickers = [...COMMUNITY_TRACK_TICKERS];
  const logs: CommunityFetchLog[] = [];
  const marketMap = await fetchMarketStocks(tickers, logs);

  const items: CommunityStockItem[] = [];
  const allPosts: CommunityPost[] = [];

  for (const ticker of tickers) {
    const catalog = getCatalogEntry(ticker);
    const market = marketMap.get(ticker);
    const stockName = resolveStockName(ticker, market?.name ?? catalog?.name);

    let posts: CommunityPost[] = [];

    const discuss = await fetchNaverDiscussPosts(ticker);
    logs.push(discuss.log);
    posts = [...posts, ...discuss.posts];

    if (isNaverSearchAvailable()) {
      const search = await fetchNaverProxyCommunityPosts(ticker, stockName);
      logs.push(...search.logs);
      posts = [...posts, ...search.posts];
    }

    if (posts.length === 0) {
      logs.push(
        createFetchLog({
          source: 'collector',
          code: 'TICKER_NO_POSTS',
          message: 'no discuss or search posts for ticker',
          ticker,
          responseCount: 0,
          durationMs: 0,
        }),
      );
    }

    allPosts.push(...posts);
    const item = buildItem(ticker, posts, market);
    if (item) items.push(item);

    await new Promise((r) => setTimeout(r, 120));
  }

  items.sort((a, b) => b.communityScore - a.communityScore);
  const summary = buildSummary(tickers, items, allPosts);
  const warnings = collectWarningCodes(logs);
  const outcome = evaluateCollectOutcome({
    marketTickerCount: marketMap.size,
    discussPostCount: summary.discussPosts,
    itemCount: items.length,
    logs,
  });

  if (!outcome.canLive) {
    logs.push(
      createFetchLog({
        source: 'collector',
        code: 'LIVE_COLLECT_NO_ITEMS',
        message: outcome.fallbackReason ?? 'critical sources failed',
        responseCount: 0,
        durationMs: Date.now() - now,
      }),
    );
  }

  const sourceStatuses = buildSourceStatuses(logs);

  return {
    canLive: outcome.canLive,
    fallbackReason: outcome.fallbackReason,
    logs,
    summary,
    response: {
      items,
      collectedAt: new Date(now).toISOString(),
      providerType: 'live',
      dataKind: 'live',
      nextCollectAt: new Date(now + COLLECT_INTERVAL_MS).toISOString(),
      sourcesNote: buildSourcesNote(isNaverSearchAvailable(), warnings),
    },
    sourceStatuses,
    warnings,
  };
}

export function attachDebug(
  response: CommunitySentimentResponse,
  logs: CommunityFetchLog[],
  summary: CommunityCollectSummary,
  fetchStartedAt: string,
  fetchDurationMs: number,
  opts?: {
    fallbackCode?: CommunityCollectCode;
    fallbackMessage?: string;
    sourceStatuses?: CommunityCollectDebug['sourceStatuses'];
    warnings?: CommunityCollectCode[];
  },
): CommunitySentimentResponse {
  return {
    ...response,
    debug: {
      dataKind: response.dataKind ?? response.providerType,
      fallbackCode: opts?.fallbackCode,
      fallbackMessage: opts?.fallbackMessage,
      fetchStartedAt,
      fetchDurationMs,
      logs,
      summary,
      sourceStatuses: opts?.sourceStatuses,
      warnings: opts?.warnings,
    },
  };
}
