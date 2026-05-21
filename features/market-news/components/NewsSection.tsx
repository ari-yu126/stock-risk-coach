'use client';

import { useState, useEffect } from 'react';
import { ShowMoreList } from '@/components/ui/ShowMoreList';
import type { NewsArticle, NewsResponse } from '../lib/providers/types';

const NEWS_INITIAL_COUNT = 3;

const FILTER_ALL = '전체';
const FILTER_KEYWORDS = ['국내 증시', '반도체', '2차전지', '바이오', 'AI 데이터센터', '자동차'] as const;
const PILLS = [FILTER_ALL, ...FILTER_KEYWORDS] as const;

type Pill = (typeof PILLS)[number];

interface FetchResult {
  response: NewsResponse | null;
  error: boolean;
  loaded: boolean;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}일 전`;
  if (h >= 1) return `${h}시간 전`;
  if (m >= 1) return `${m}분 전`;
  return '방금';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProviderBadge({ providerType }: { providerType: 'naver' | 'mock' }) {
  if (providerType === 'naver') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
        실제 뉴스 사용 중
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      샘플 뉴스 사용 중
    </span>
  );
}

function ArticleItem({ article }: { article: NewsArticle }) {
  const hasLink = Boolean(article.link) && article.link !== '#';

  return (
    <div className="border-b border-gray-100 py-3.5 last:border-0">
      {hasLink ? (
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-start gap-1"
        >
          <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
            {article.title}
          </p>
          <svg
            aria-hidden="true"
            className="mt-0.5 h-3 w-3 shrink-0 text-gray-300 group-hover:text-blue-400 transition-colors"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1.5 8.5L8.5 1.5M8.5 1.5H4.5M8.5 1.5V5.5" />
          </svg>
        </a>
      ) : (
        <p className="text-sm font-medium text-gray-900">{article.title}</p>
      )}

      {article.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
          {article.description}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span>{article.source}</span>
        <span>·</span>
        <span>{formatRelativeTime(article.publishedAt)}</span>
        {article.matchedKeywords.length > 0 && (
          <>
            <span>·</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">
              {article.matchedKeywords[0]}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SkeletonItem() {
  return (
    <div className="animate-pulse border-b border-gray-100 py-3.5 last:border-0">
      <div className="h-4 w-3/4 rounded bg-gray-100" />
      <div className="mt-1.5 h-3 w-full rounded bg-gray-100" />
      <div className="mt-1 h-3 w-1/2 rounded bg-gray-100" />
      <div className="mt-2 flex gap-2">
        <div className="h-3 w-16 rounded bg-gray-100" />
        <div className="h-3 w-12 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function NewsSection({ compact = false, maxItems = 5 }: { compact?: boolean; maxItems?: number }) {
  const [activePill, setActivePill] = useState<Pill>(FILTER_ALL);
  const [result, setResult] = useState<FetchResult>({ response: null, error: false, loaded: false });

  useEffect(() => {
    let cancelled = false;

    fetch('/api/market-news')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<NewsResponse>;
      })
      .then((data) => {
        if (!cancelled) setResult({ response: data, error: false, loaded: true });
      })
      .catch(() => {
        if (!cancelled) setResult({ response: null, error: true, loaded: true });
      });

    return () => { cancelled = true; };
  }, []);

  const { loaded, error, response } = result;
  const providerType = response?.providerType ?? null;

  const articles: NewsArticle[] =
    !loaded || error
      ? []
      : activePill === FILTER_ALL
        ? (response?.articles ?? [])
        : (response?.articles ?? []).filter((a) =>
            a.matchedKeywords.includes(activePill),
          );

  const display = articles.slice(0, compact ? maxItems : articles.length);
  const Wrapper = compact ? 'div' : 'section';

  return (
    <Wrapper>
      {!compact && (
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">섹터별 뉴스</h2>
          {loaded && providerType && <ProviderBadge providerType={providerType} />}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        {PILLS.map((pill) => (
          <button
            key={pill}
            type="button"
            onClick={() => setActivePill(pill)}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium text-gray-500 ${
              activePill === pill ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-200 bg-white'
            }`}
          >
            {pill}
          </button>
        ))}
      </div>

      <div className={`rounded-xl border border-gray-200 bg-white ${compact ? 'px-3' : 'px-5'}`}>
        {!loaded && (
          <div role="status" aria-label="뉴스 로딩 중">
            {Array.from({ length: NEWS_INITIAL_COUNT }).map((_, i) => <SkeletonItem key={i} />)}
          </div>
        )}

        {loaded && error && (
          <p className="py-10 text-center text-sm text-gray-400">
            뉴스를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        )}

        {loaded && !error && articles.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            해당 섹터의 뉴스가 없어요.
          </p>
        )}

        {loaded && !error && display.length > 0 &&
          (compact ? (
            display.map((a, i) => <ArticleItem key={`${a.link}-${i}`} article={a} />)
          ) : (
            <ShowMoreList
              items={articles}
              limit={NEWS_INITIAL_COUNT}
              resetKey={activePill}
              getItemKey={(article, i) => `${article.link || article.title}-${i}`}
              moreLabel={(n) => `더보기 (${n}건)`}
              renderItem={(article) => <ArticleItem article={article} />}
            />
          ))}
      </div>
    </Wrapper>
  );
}
