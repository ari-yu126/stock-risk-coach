'use client';

import { useState, useEffect, useMemo } from 'react';
import type { NewsResponse } from '../lib/providers/types';
import {
  detectThemesWithDebug,
  type DetectedTheme,
  type DebugThemeDetail,
  type ThemeDebugReport,
} from '../lib/themeDetection';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function strengthLabel(score: number): string {
  if (score >= 70) return '강';
  if (score >= 40) return '중';
  return '약';
}

function strengthColor(score: number): { bar: string; text: string; border: string } {
  if (score >= 70) return { bar: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-200' };
  if (score >= 40) return { bar: 'bg-amber-400', text: 'text-amber-600', border: 'border-amber-200' };
  return { bar: 'bg-gray-300', text: 'text-gray-500', border: 'border-gray-200' };
}

const SENTIMENT_META: Record<DetectedTheme['sentimentSummary'], { label: string; cls: string }> = {
  positive: { label: '상승 우세', cls: 'text-green-600' },
  negative: { label: '하락 우세', cls: 'text-red-500' },
  neutral:  { label: '혼조',     cls: 'text-gray-400' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ThemeCard({ theme }: { theme: DetectedTheme }) {
  const colors = strengthColor(theme.strengthScore);
  const sentiment = SENTIMENT_META[theme.sentimentSummary];

  return (
    <div className={`rounded-xl border bg-white p-4 ${colors.border}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{theme.name}</span>
        <span className={`shrink-0 text-xs font-bold ${colors.text}`}>
          {strengthLabel(theme.strengthScore)} {theme.strengthScore}
        </span>
      </div>

      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${theme.strengthScore}%` }}
        />
      </div>

      <div className="mb-3 flex items-center gap-3 text-xs text-gray-500">
        <span>기사 {theme.newsCount}건</span>
        <span aria-hidden="true">·</span>
        <span className={sentiment.cls}>{sentiment.label}</span>
        <span aria-hidden="true">·</span>
        <span className={`font-medium ${theme.matchConfidence >= 70 ? 'text-green-600' : theme.matchConfidence >= 50 ? 'text-amber-600' : 'text-orange-500'}`}>
          신뢰도 {theme.matchConfidence}%
        </span>
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-gray-600">
        {theme.representativeHeadline}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4">
      <div className="mb-3 flex justify-between">
        <div className="h-4 w-24 rounded bg-gray-100" />
        <div className="h-4 w-10 rounded bg-gray-100" />
      </div>
      <div className="mb-3 h-1.5 w-full rounded-full bg-gray-100" />
      <div className="mb-3 h-3 w-32 rounded bg-gray-100" />
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ── Debug components ──────────────────────────────────────────────────────────

function DebugThemeRow({ info }: { info: DebugThemeDetail }) {
  const [open, setOpen] = useState(false);
  const total = info.matchedCount + info.excludedCount + info.nearMissCount;

  return (
    <div className="rounded-lg border border-violet-100 bg-white text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-violet-50/50 transition-colors"
      >
        <span className="w-32 shrink-0 font-medium text-gray-700">
          {info.themeName}
          {info.rankedOut && (
            <span className="ml-1 rounded bg-orange-100 px-1 text-[10px] text-orange-600">TOP5 제외</span>
          )}
        </span>
        <span className="text-green-600">✓ {info.matchedCount}건</span>
        {info.excludedCount > 0 && <span className="text-red-500">⊘ 제외 {info.excludedCount}건</span>}
        {info.nearMissCount > 0 && <span className="text-amber-500">≈ 근접 {info.nearMissCount}건</span>}
        {total === 0 && <span className="text-gray-300">키워드 없음</span>}
        <span className="ml-auto text-gray-300">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-violet-100 px-3 py-2 space-y-3">
          {/* Keyword coverage */}
          <div>
            <p className="mb-1 text-[11px] font-semibold text-gray-400">키워드 커버리지</p>
            <div className="flex flex-wrap gap-1.5">
              {info.keywordStats.map((stat) => (
                <span
                  key={`${stat.type}-${stat.keyword}`}
                  className={`rounded px-1.5 py-0.5 ${stat.articleCount > 0
                    ? stat.type === 'strong'
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'bg-gray-100 text-gray-600'
                    : 'bg-gray-50 text-gray-300'
                  }`}
                >
                  {stat.keyword} <span className="font-bold">{stat.articleCount}</span>
                  {stat.type === 'strong' && <span className="text-[9px] ml-0.5 text-blue-400">S</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Excluded articles */}
          {info.excludedTitles.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-red-400">
                제외된 기사 ({info.excludedTitles.length}건) — 제외 키워드 트리거
              </p>
              <ul className="space-y-0.5">
                {info.excludedTitles.slice(0, 5).map((e, i) => (
                  <li key={i} className="flex items-start gap-1 text-gray-500">
                    <span className="shrink-0 text-red-300">⊘</span>
                    <span className="line-clamp-1">{e.title}</span>
                    <span className="shrink-0 text-red-300">({e.excludedBy})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Near-miss articles */}
          {info.nearMissTitles.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold text-amber-500">
                근접 미매칭 ({info.nearMissTitles.length}건)
              </p>
              <ul className="space-y-0.5">
                {info.nearMissTitles.slice(0, 5).map((n, i) => (
                  <li key={i} className="flex items-start gap-1 text-gray-500">
                    <span className="shrink-0 text-amber-300">≈</span>
                    <span className="line-clamp-1">{n.title}</span>
                    <span className="shrink-0 text-gray-400">({n.reason})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DebugPanel({ report }: { report: ThemeDebugReport }) {
  const unmatchedShown = report.unmatchedArticles.slice(0, 20);

  return (
    <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/40 p-4 text-xs">
      {/* Summary bar */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-bold text-violet-700">🔍 테마 감지 디버그</span>
        <span className="text-violet-500">전체 기사 {report.totalArticles}건</span>
        <span className="text-green-600">테마 매칭 {report.matchedArticleCount}건</span>
        <span className="text-gray-400">미매칭 {report.unmatchedArticles.length}건</span>
        <span className="text-orange-500">
          TOP5 이상: {report.themes.filter((t) => t.rankedOut).length}개 테마 제외됨
        </span>
      </div>

      {/* Per-theme rows */}
      <div className="mb-4 space-y-1">
        {report.themes.map((info) => (
          <DebugThemeRow key={info.themeId} info={info} />
        ))}
      </div>

      {/* Unmatched articles */}
      {report.unmatchedArticles.length > 0 && (
        <div>
          <p className="mb-2 font-semibold text-gray-500">
            테마 미매칭 기사 ({report.unmatchedArticles.length}건
            {report.unmatchedArticles.length > 20 ? ' — 상위 20건 표시' : ''})
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {unmatchedShown.map((a, i) => (
              <div key={i} className="rounded bg-white px-2 py-1.5 text-gray-600">
                <p className="line-clamp-1 font-medium text-gray-700">{a.title}</p>
                {a.closestTheme ? (
                  <p className="text-gray-400">
                    가장 근접: <span className="text-amber-600">{a.closestTheme}</span> — {a.closestReason}
                  </p>
                ) : (
                  <p className="text-gray-400">모든 테마에서 키워드 없음</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ThemeSection() {
  const [newsResponse, setNewsResponse] = useState<NewsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/market-news')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<NewsResponse>;
      })
      .then((data) => {
        if (!cancelled) { setNewsResponse(data); setLoaded(true); }
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoaded(true); }
      });

    return () => { cancelled = true; };
  }, []);

  const { themes, debug } = useMemo(() => {
    if (!newsResponse) return { themes: [], debug: null };
    return detectThemesWithDebug(newsResponse.articles);
  }, [newsResponse]);

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">오늘 뉴스 테마</h2>
          <p className="text-sm text-gray-500">실시간 뉴스 빈도와 감성을 기반으로 감지한 시장 테마</p>
        </div>
        <div className="flex items-center gap-2">
          {loaded && !error && newsResponse?.fetchedAt && (
            <span className="mt-1 shrink-0 text-[11px] text-gray-400">
              업데이트 {fmtTime(newsResponse.fetchedAt)}
            </span>
          )}
          {loaded && !error && (
            <button
              onClick={() => setShowDebug((v) => !v)}
              aria-pressed={showDebug}
              className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                showDebug
                  ? 'border-violet-400 bg-violet-100 text-violet-700'
                  : 'border-gray-200 bg-white text-gray-400 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              디버그
            </button>
          )}
        </div>
      </div>

      {/* Debug panel */}
      {showDebug && debug && (
        <div className="mb-4">
          <DebugPanel report={debug} />
        </div>
      )}

      {!loaded && (
        <div role="status" aria-label="테마 로딩 중" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {loaded && error && (
        <p className="py-10 text-center text-sm text-gray-400">
          테마를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
        </p>
      )}

      {loaded && !error && themes.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-400">
          감지된 테마가 없어요.
        </p>
      )}

      {loaded && !error && themes.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <ThemeCard key={theme.id} theme={theme} />
          ))}
        </div>
      )}
    </section>
  );
}
