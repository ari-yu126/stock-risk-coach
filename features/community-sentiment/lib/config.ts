import type { CommunitySource } from '../types';

export const COMMUNITY_WEIGHTS: Record<CommunitySource, number> = {
  'naver-jongto': 0.5,
  'dc-stock': 0.3,
  'fmkorea-stock': 0.2,
};

export const POSITIVE_KEYWORDS = [
  '떡상', '실적', '수혜', '돌파', '강세', '매집', '급등', '상승', '호재', '반등',
];

export const NEGATIVE_KEYWORDS = [
  '설거지', '나락', '손절', '악재', '폭락', '고점', '개미털기', '하락', '공매', '우려',
];

export const SURGE_KEYWORDS = ['급등', '폭등', '돌파', '신고가', '테마'];

/** Trend keyword → bonus points (max contribution capped in scorer) */
export const TREND_KEYWORD_POINTS: Record<string, number> = {
  AI: 15,
  데이터센터: 12,
  HBM: 12,
  실적: 10,
  수주: 10,
  반도체: 8,
  로봇: 8,
  바이오: 8,
};

export const SCORE_WEIGHTS = {
  sentiment: 0.4,
  mentionGrowth: 0.3,
  volumeGrowth: 0.2,
  trendKeyword: 0.1,
} as const;

export const COLLECT_INTERVAL_MS = 60 * 60 * 1000;
export const DATA_RETENTION_HOURS = 24;

/** Tickers scanned each collect cycle (Naver discuss + search). */
export const COMMUNITY_TRACK_TICKERS = [
  '005930', '000660', '042700', '086520', '247540',
  '277810', '035420', '068270', '005380', '373220',
  '196170', '035720',
] as const;

export const DISCUSS_PAGE_SIZE = 25;
export const NAVER_SEARCH_DISPLAY = 8;
