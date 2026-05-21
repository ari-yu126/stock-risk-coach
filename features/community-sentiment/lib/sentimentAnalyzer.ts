import {
  NEGATIVE_KEYWORDS,
  POSITIVE_KEYWORDS,
  TREND_KEYWORD_POINTS,
} from './config';
import type { SentimentAnalyzer, SentimentLabel } from '../types';

function countHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((n, kw) => (lower.includes(kw.toLowerCase()) ? n + 1 : n), 0);
}

function findTrendHits(text: string): string[] {
  const hits: string[] = [];
  for (const kw of Object.keys(TREND_KEYWORD_POINTS)) {
    if (text.includes(kw)) hits.push(kw);
  }
  return hits;
}

/** Keyword-based analyzer — replace `defaultAnalyzer` with LLM adapter later */
export const keywordSentimentAnalyzer: SentimentAnalyzer = {
  analyze(text: string) {
    const positiveHits = countHits(text, POSITIVE_KEYWORDS);
    const negativeHits = countHits(text, NEGATIVE_KEYWORDS);
    const trendHits = findTrendHits(text);
    const total = positiveHits + negativeHits;

    let sentiment: SentimentLabel = 'neutral';
    let score = 50;

    if (total > 0) {
      score = Math.round((positiveHits / total) * 100);
      if (positiveHits > negativeHits) sentiment = 'positive';
      else if (negativeHits > positiveHits) sentiment = 'negative';
    }

    return { sentiment, positiveHits, negativeHits, trendHits, score };
  },
};
