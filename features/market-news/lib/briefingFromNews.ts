import type { MarketBriefing, MarketSentiment } from '../types';
import type { NewsArticle } from './providers/types';
import { detectThemes, type DetectedTheme } from './themeDetection';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const SENTIMENT_PHRASE: Record<DetectedTheme['sentimentSummary'], string> = {
  positive: '긍정 뉴스가 우세',
  negative: '부담·조정 뉴스가 우세',
  neutral: '방향이 엇갈리는 혼조',
};

function aggregateSentiment(themes: DetectedTheme[]): MarketSentiment {
  if (themes.length === 0) return 'mixed';

  let posWeight = 0;
  let negWeight = 0;
  for (const t of themes.slice(0, 3)) {
    if (t.sentimentSummary === 'positive') posWeight += t.strengthScore;
    else if (t.sentimentSummary === 'negative') negWeight += t.strengthScore;
  }

  if (posWeight > negWeight * 1.15) return 'bullish';
  if (negWeight > posWeight * 1.15) return 'bearish';
  return 'mixed';
}

function buildSummary(themes: DetectedTheme[], articleCount: number): string {
  if (themes.length === 0) {
    return articleCount > 0
      ? '뉴스는 수집됐지만 뚜렷한 섹터 테마 신호는 아직 약해요. 개별 이슈 위주로 살펴보는 편이 좋아요.'
      : '오늘 수집된 뉴스가 없어 브리핑을 만들지 못했어요. 잠시 후 다시 확인해주세요.';
  }

  const clauses = themes.slice(0, 3).map(
    (t) => `${t.name}(${t.newsCount}건·강도 ${t.strengthScore})은 ${SENTIMENT_PHRASE[t.sentimentSummary]}`,
  );

  const overall = aggregateSentiment(themes);
  const tail =
    overall === 'bullish'
      ? '상위 테마 기준으로 위험선호 흐름이 두드러져요.'
      : overall === 'bearish'
        ? '상위 테마 기준으로 위험회피·조정 흐름이 두드러져요.'
        : '섹터별 온도차가 뚜렷한 혼조 장세로 읽혀요.';

  return `${clauses.join('. ')}. ${tail}`;
}

/** Build today's briefing from the same news articles used by /api/market-news. */
export function buildBriefingFromNews(articles: NewsArticle[]): MarketBriefing {
  const themes = detectThemes(articles);
  const overallSentiment = aggregateSentiment(themes);

  return {
    date: todayISO(),
    summary: buildSummary(themes, articles.length),
    keyThemes: themes.slice(0, 4).map((t) => t.name),
    overallSentiment,
  };
}
