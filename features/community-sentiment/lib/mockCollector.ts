import { COMMUNITY_WEIGHTS } from './config';
import { keywordSentimentAnalyzer } from './sentimentAnalyzer';
import {
  buildAiSummary,
  calcCommentSentimentRatios,
  calcCommunityScore,
  calcRiskLevel,
  calcTrendKeywordScore,
  calcWeightedSentimentScore,
} from './communityScore';
import type {
  CommunityPost,
  CommunitySentimentResponse,
  CommunitySource,
  CommunityStockItem,
  HourlySnapshot,
} from '../types';

const STOCKS = [
  { ticker: '005930', name: '삼성전자', sector: '반도체', baseVol: 1.1, priceChg: 0.8 },
  { ticker: '000660', name: 'SK하이닉스', sector: '반도체', baseVol: 2.4, priceChg: 2.1 },
  { ticker: '042700', name: '한미반도체', sector: '반도체', baseVol: 3.2, priceChg: 5.8 },
  { ticker: '086520', name: '에코프로', sector: '2차전지', baseVol: 5.5, priceChg: 7.3 },
  { ticker: '247540', name: '에코프로비엠', sector: '2차전지', baseVol: 3.1, priceChg: 6.1 },
  { ticker: '277810', name: '레인보우로보틱스', sector: '로봇', baseVol: 2.8, priceChg: 4.2 },
  { ticker: '035420', name: 'NAVER', sector: '플랫폼', baseVol: 0.9, priceChg: -1.2 },
  { ticker: '068270', name: '셀트리온', sector: '바이오', baseVol: 1.4, priceChg: 1.5 },
] as const;

const MOCK_TITLES: Record<string, string[]> = {
  '005930': ['AI 데이터센터 수혜 기대', '실적 시즌 돌파 기대감', '반도체 강세 지속?'],
  '000660': ['HBM 수요 폭발', '엔비디아 수혜 재평가', '고점 우려 vs 매집'],
  '042700': ['급등 후 설거지?', '테마주 떡상', '손절 vs 홀딩'],
  '086520': ['2차전지 악재 우려', '거래량 폭등', '개미털기 느낌'],
  '247540': ['실적 기대', '수주 뉴스', '변동성 과열'],
  '277810': ['로봇 AI 테마', '정부 정책 수혜', '강세 지속'],
  '035420': ['플랫폼 규제 우려', '반등 시도', '중립 흐름'],
  '068270': ['바이오 임상 기대', '실적 호재', '안정적 흐름'],
};

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generatePosts(ticker: string, now: number): CommunityPost[] {
  const rand = seededRand(parseInt(ticker, 10));
  const titles = MOCK_TITLES[ticker] ?? ['종목 언급'];
  const sources = Object.keys(COMMUNITY_WEIGHTS) as CommunitySource[];
  const posts: CommunityPost[] = [];

  for (const source of sources) {
    const count = source === 'naver-jongto' ? 4 + Math.floor(rand() * 3) : 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      const title = titles[Math.floor(rand() * titles.length)];
      const text = `${title} ${ticker}`;
      const analyzed = keywordSentimentAnalyzer.analyze(text);
      const hoursAgo = Math.floor(rand() * 24);
      posts.push({
        id: `${source}-${ticker}-${i}-${now}`,
        source,
        ticker,
        title,
        commentCount: 5 + Math.floor(rand() * 80),
        positiveHits: analyzed.positiveHits,
        negativeHits: analyzed.negativeHits,
        trendHits: analyzed.trendHits,
        sentiment: analyzed.sentiment,
        sentimentScore: analyzed.score,
        publishedAt: new Date(now - hoursAgo * 3_600_000).toISOString(),
      });
    }
  }
  return posts;
}

function generateHourly(ticker: string, mentionBase: number, sentiment: number, vol: number): HourlySnapshot[] {
  const rand = seededRand(parseInt(ticker, 10) + 99);
  const now = Date.now();
  const points: HourlySnapshot[] = [];

  for (let h = 23; h >= 0; h--) {
    const t = new Date(now - h * 3_600_000);
    const wave = Math.sin(h / 4) * 0.3 + rand() * 0.4;
    points.push({
      hour: t.toISOString(),
      mentionCount: Math.max(0, Math.round(mentionBase * (0.5 + wave))),
      sentimentScore: Math.min(100, Math.max(0, Math.round(sentiment + (rand() - 0.5) * 20))),
      volumeRatio: Math.max(0.3, vol * (0.7 + rand() * 0.6)),
    });
  }
  return points;
}

function groupBySource(posts: CommunityPost[]): Map<CommunitySource, CommunityPost[]> {
  const map = new Map<CommunitySource, CommunityPost[]>();
  for (const p of posts) {
    const list = map.get(p.source) ?? [];
    list.push(p);
    map.set(p.source, list);
  }
  return map;
}

export function collectMockCommunitySentiment(): CommunitySentimentResponse {
  const now = Date.now();
  const collectedAt = new Date(now).toISOString();
  const items: CommunityStockItem[] = [];

  for (const stock of STOCKS) {
    const posts = generatePosts(stock.ticker, now);
    const bySource = groupBySource(posts);
    const mentionCount = posts.length;
    const rand = seededRand(parseInt(stock.ticker, 10));
    const avg7d = 8 + Math.floor(rand() * 6);
    const mentionGrowth = mentionCount / avg7d;
    const volumeGrowth = stock.baseVol;
    const allTrend = posts.flatMap((p) => p.trendHits);
    const trendKeywordScore = calcTrendKeywordScore(allTrend);
    const sentimentScore = calcWeightedSentimentScore(posts, bySource);

    const {
      positiveRatio,
      negativeRatio,
      neutralRatio,
      totalComments,
    } = calcCommentSentimentRatios(posts);

    const communityScore = calcCommunityScore({
      sentimentScore,
      mentionGrowth,
      volumeGrowth,
      trendKeywordScore,
    });

    const hourly = generateHourly(stock.ticker, mentionCount / 24, sentimentScore, volumeGrowth);
    const hourOverHourChange =
      hourly.length >= 2
        ? communityScore - Math.round(communityScore * (hourly[hourly.length - 2].sentimentScore / 100))
        : 0;

    const riskLevel = calcRiskLevel({
      mentionGrowth,
      negativeRatio,
      volumeGrowth,
      priceChangePercent: stock.priceChg,
      hourly,
      mentionCount,
    });

    const fomoHigh = mentionGrowth >= 2.2 && volumeGrowth >= 3 && sentimentScore >= 55;
    const overheatWarning = volumeGrowth >= 4 || (mentionGrowth >= 2.5 && stock.priceChg > 6);

    items.push({
      ticker: stock.ticker,
      name: stock.name,
      sector: stock.sector,
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
      priceChangePercent: stock.priceChg,
    });
  }

  items.sort((a, b) => b.communityScore - a.communityScore);

  return {
    items,
    collectedAt,
    providerType: 'mock',
    dataKind: 'mock',
    nextCollectAt: new Date(now + 60 * 60 * 1000).toISOString(),
  };
}
