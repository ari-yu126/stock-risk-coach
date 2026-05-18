import type { NewsArticle } from './providers/types';
import { THEME_DEFINITIONS, type ThemeDefinition } from './themeKeywords';

export interface DetectedTheme {
  id: string;
  name: string;
  newsCount: number;
  strengthScore: number;       // 0–100
  sentimentSummary: 'positive' | 'negative' | 'neutral';
  representativeHeadline: string;
  matchConfidence: number;     // 0–100: average keyword-match quality across matched articles
  // ── Freshness diagnostics ────────────────────────────────────────────────────
  freshnessScore: number;      // 0.0–1.0 average freshness of matched articles
  newestArticleAt: string;     // ISO of most recently published matched article
  oldestArticleAt: string;     // ISO of oldest matched article
}

// ── Debug types ───────────────────────────────────────────────────────────────

export interface DebugKeywordStat {
  keyword: string;
  type: 'strong' | 'weak';
  articleCount: number; // # articles in which this keyword appeared (regardless of match threshold)
}

export interface DebugThemeDetail {
  themeId: string;
  themeName: string;
  matchedCount: number;        // articles that met the match threshold
  excludedCount: number;       // articles blocked by an exclusion keyword
  nearMissCount: number;       // articles with 1 weak keyword (needed 2, no strong)
  keywordStats: DebugKeywordStat[];
  excludedTitles: Array<{ title: string; excludedBy: string }>;
  nearMissTitles: Array<{ title: string; reason: string }>;
  rankedOut: boolean;          // had matches but was outside TOP_N
}

export interface DebugUnmatchedArticle {
  title: string;
  closestTheme: string | null;
  closestReason: string | null; // why it didn't match the closest theme
}

export interface ThemeDebugReport {
  totalArticles: number;
  matchedArticleCount: number; // unique articles matching ≥1 theme
  unmatchedArticles: DebugUnmatchedArticle[];
  themes: DebugThemeDetail[];  // ALL 7 themes (including rankedOut ones), sorted by matchedCount desc
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TOP_N = 5;

function articleText(article: NewsArticle): string {
  return `${article.title} ${article.description}`.toLowerCase();
}

/**
 * Per-article confidence based on keyword strength.
 *   2+ strong → 95
 *   1 strong + 2+ weak → 85
 *   1 strong → 70
 *   0 strong + 4+ weak → 65
 *   0 strong + 3 weak → 55
 *   0 strong + 2 weak → 40 (minimum match threshold)
 */
function calcArticleConfidence(strongCount: number, weakCount: number): number {
  if (strongCount >= 2)                    return 95;
  if (strongCount === 1 && weakCount >= 2) return 85;
  if (strongCount === 1)                   return 70;
  if (weakCount >= 4)                      return 65;
  if (weakCount >= 3)                      return 55;
  return 40; // 0 strong + 2 weak (minimum)
}

interface ArticleMatch {
  article: NewsArticle;
  confidence: number;
  matchedKeywords: string[]; // strong + weak keywords that fired
}

function matchArticle(article: NewsArticle, theme: ThemeDefinition): ArticleMatch | null {
  const text = articleText(article);

  if (theme.exclusionKeywords.some((kw) => text.includes(kw.toLowerCase()))) return null;

  const matchedStrong = theme.strongKeywords.filter((kw) => text.includes(kw.toLowerCase()));
  const matchedWeak   = theme.weakKeywords.filter((kw) => text.includes(kw.toLowerCase()));

  if (matchedStrong.length === 0 && matchedWeak.length < 2) return null;

  return {
    article,
    confidence: calcArticleConfidence(matchedStrong.length, matchedWeak.length),
    matchedKeywords: [...matchedStrong, ...matchedWeak],
  };
}

type Sentiment = 'positive' | 'negative' | 'neutral';

function scoreArticleSentiment(article: NewsArticle, theme: ThemeDefinition): Sentiment {
  const text = articleText(article);
  const pos = theme.positiveSignals.filter((s) => text.includes(s)).length;
  const neg = theme.negativeSignals.filter((s) => text.includes(s)).length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function majorSentiment(sentiments: Sentiment[]): Sentiment {
  const pos = sentiments.filter((s) => s === 'positive').length;
  const neg = sentiments.filter((s) => s === 'negative').length;
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

function calcStrength(weightedCount: number, sentiment: Sentiment): number {
  const frequencyScore = Math.min(weightedCount * 20, 100);
  const sentimentBonus = sentiment === 'positive' ? 10 : sentiment === 'negative' ? -10 : 0;
  return Math.min(Math.max(frequencyScore + sentimentBonus, 0), 100);
}

// ── Freshness scoring ─────────────────────────────────────────────────────────

export function calcFreshness(publishedAt: string): number {
  const ageMinutes = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60);
  if (ageMinutes <= 10)   return 1.0;
  if (ageMinutes <= 30)   return 0.9;
  if (ageMinutes <= 60)   return 0.75;
  if (ageMinutes <= 180)  return 0.5;
  if (ageMinutes <= 1440) return 0.25;
  return 0.1;
}

export function calcAgeMinutes(publishedAt: string): number {
  return (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60);
}

// ── Trace types (used by candidates route for news→candidate diagnostics) ─────

export interface ThemeArticleMatch {
  title: string;
  source: string;
  publishedAt: string;
  matchedKeywords: string[];
  freshnessScore: number;
}

// ── Core builder (shared by detectThemes and detectThemesWithTraces) ──────────

function buildThemes(articles: NewsArticle[]): {
  themes: DetectedTheme[];
  traceMap: Map<string, ThemeArticleMatch[]>;
} {
  const themes: DetectedTheme[] = [];
  const traceMap = new Map<string, ThemeArticleMatch[]>();

  for (const theme of THEME_DEFINITIONS) {
    const matches: ArticleMatch[] = [];
    const sentiments: Sentiment[] = [];
    const traceEntries: ThemeArticleMatch[] = [];

    for (const article of articles) {
      const match = matchArticle(article, theme);
      if (!match) continue;
      matches.push(match);
      sentiments.push(scoreArticleSentiment(article, theme));
      traceEntries.push({
        title: article.title,
        source: article.source,
        publishedAt: article.publishedAt,
        matchedKeywords: match.matchedKeywords,
        freshnessScore: calcFreshness(article.publishedAt),
      });
    }

    if (matches.length === 0) continue;

    const freshnessPerArticle = traceEntries.map((e) => e.freshnessScore);
    const avgFreshness = freshnessPerArticle.reduce((s, f) => s + f, 0) / freshnessPerArticle.length;
    const weightedCount = freshnessPerArticle.reduce((s, f) => s + f, 0);

    const publishedTimes = matches.map((m) => new Date(m.article.publishedAt).getTime());
    const newestAt = new Date(Math.max(...publishedTimes)).toISOString();
    const oldestAt = new Date(Math.min(...publishedTimes)).toISOString();

    traceMap.set(theme.id, traceEntries);

    const sentimentSummary = majorSentiment(sentiments);
    const matchConfidence = Math.round(
      matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length,
    );

    const representative = matches.reduce((latest, m) =>
      new Date(m.article.publishedAt) > new Date(latest.article.publishedAt) ? m : latest,
    );

    themes.push({
      id: theme.id,
      name: theme.name,
      newsCount: matches.length,
      strengthScore: calcStrength(weightedCount, sentimentSummary),
      sentimentSummary,
      representativeHeadline: representative.article.title,
      matchConfidence,
      freshnessScore: Math.round(avgFreshness * 100) / 100,
      newestArticleAt: newestAt,
      oldestArticleAt: oldestAt,
    });
  }

  const sorted = themes.sort((a, b) => b.strengthScore - a.strengthScore).slice(0, TOP_N);
  return { themes: sorted, traceMap };
}

// ── Main exports ───────────────────────────────────────────────────────────────

export function detectThemes(articles: NewsArticle[]): DetectedTheme[] {
  return buildThemes(articles).themes;
}

export function detectThemesWithTraces(articles: NewsArticle[]): {
  themes: DetectedTheme[];
  traceMap: Map<string, ThemeArticleMatch[]>;
} {
  return buildThemes(articles);
}

// ── Debug variant ─────────────────────────────────────────────────────────────

export function detectThemesWithDebug(articles: NewsArticle[]): {
  themes: DetectedTheme[];
  debug: ThemeDebugReport;
} {
  const themes = detectThemes(articles);
  const detectedIds = new Set(themes.map((t) => t.id));

  // Per-theme tracking
  const debugMap = new Map<string, DebugThemeDetail>();
  for (const def of THEME_DEFINITIONS) {
    debugMap.set(def.id, {
      themeId: def.id,
      themeName: def.name,
      matchedCount: 0,
      excludedCount: 0,
      nearMissCount: 0,
      keywordStats: [
        ...def.strongKeywords.map((kw) => ({ keyword: kw, type: 'strong' as const, articleCount: 0 })),
        ...def.weakKeywords.map((kw) => ({ keyword: kw, type: 'weak' as const, articleCount: 0 })),
      ],
      excludedTitles: [],
      nearMissTitles: [],
      rankedOut: false,
    });
  }

  // Track which article titles matched at least one theme
  const matchedTitles = new Set<string>();

  // For each article, track the "best near-miss" theme for the unmatched report
  const articleBestMiss = new Map<string, { theme: string; reason: string; score: number }>();

  for (const article of articles) {
    const text = articleText(article);

    for (const def of THEME_DEFINITIONS) {
      const dbg = debugMap.get(def.id)!;

      // Keyword coverage — count regardless of match outcome
      for (const stat of dbg.keywordStats) {
        if (text.includes(stat.keyword.toLowerCase())) stat.articleCount++;
      }

      // Exclusion check
      const excludedBy = def.exclusionKeywords.find((kw) => text.includes(kw.toLowerCase()));
      if (excludedBy) {
        dbg.excludedCount++;
        dbg.excludedTitles.push({ title: article.title, excludedBy });
        continue;
      }

      const strongCount = def.strongKeywords.filter((kw) => text.includes(kw.toLowerCase())).length;
      const weakCount   = def.weakKeywords.filter((kw) => text.includes(kw.toLowerCase())).length;
      const score = strongCount * 2 + weakCount; // proxy for "closeness" to a match

      if (strongCount >= 1 || weakCount >= 2) {
        dbg.matchedCount++;
        matchedTitles.add(article.title);
      } else if (score > 0) {
        // Near-miss: had some keywords but didn't clear the threshold
        dbg.nearMissCount++;
        const matchedWeak = def.weakKeywords.filter((kw) => text.includes(kw.toLowerCase()));
        const reason = matchedWeak.length > 0
          ? `약한 키워드 1개 (2개 필요): '${matchedWeak[0]}'`
          : '강한 키워드 없음, 약한 키워드도 없음';
        dbg.nearMissTitles.push({ title: article.title, reason });

        // Track as potential closest theme for unmatched report
        const prev = articleBestMiss.get(article.title);
        if (!prev || score > prev.score) {
          articleBestMiss.set(article.title, { theme: def.name, reason, score });
        }
      }
    }
  }

  // Mark themes that had matches but were cut by TOP_N
  for (const [id, dbg] of debugMap) {
    if (dbg.matchedCount > 0 && !detectedIds.has(id)) {
      dbg.rankedOut = true;
    }
  }

  // Unmatched articles: those that matched no theme
  const unmatchedArticles: DebugUnmatchedArticle[] = articles
    .filter((a) => !matchedTitles.has(a.title))
    .map((a) => {
      const miss = articleBestMiss.get(a.title);
      return {
        title: a.title,
        closestTheme: miss?.theme ?? null,
        closestReason: miss?.reason ?? '모든 테마에서 키워드 없음',
      };
    });

  const debugThemes = [...debugMap.values()].sort((a, b) => b.matchedCount - a.matchedCount);

  return {
    themes,
    debug: {
      totalArticles: articles.length,
      matchedArticleCount: matchedTitles.size,
      unmatchedArticles,
      themes: debugThemes,
    },
  };
}
