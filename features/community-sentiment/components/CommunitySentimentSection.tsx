'use client';

import { useState, useEffect, useMemo } from 'react';
import type { CommunityRiskLevel, CommunitySentimentResponse, CommunityStockItem } from '../types';
import { CommunityStockCard } from './CommunityStockCard';
import { CommunityDetailModal } from './CommunityDetailModal';

type RiskFilter = 'ALL' | CommunityRiskLevel;
type SortKey = 'score' | 'mention' | 'sentiment';

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function CommunitySentimentSection() {
  const [data, setData] = useState<CommunitySentimentResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [fomoOnly, setFomoOnly] = useState(false);
  const [selected, setSelected] = useState<CommunityStockItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/community-sentiment')
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.json() as Promise<CommunitySentimentResponse>;
      })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = [...data.items];
    if (riskFilter !== 'ALL') list = list.filter((i) => i.riskLevel === riskFilter);
    if (fomoOnly) list = list.filter((i) => i.fomoHigh);
    list.sort((a, b) => {
      switch (sortBy) {
        case 'mention':
          return b.mentionGrowthPercent - a.mentionGrowthPercent;
        case 'sentiment':
          return b.sentimentScore - a.sentimentScore;
        default:
          return b.communityScore - a.communityScore;
      }
    });
    return list;
  }, [data, riskFilter, sortBy, fomoOnly]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">커뮤니티 주목 종목</h3>
          <p className="text-sm text-gray-500">
            종토방·디시·에펨 반응 + 시장 데이터 기반 Sentiment Dashboard
          </p>
        </div>
        {loaded && !error && data && (
          <div className="flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
              MVP · 샘플 커뮤니티
            </span>
            <span className="text-[11px] text-gray-400">
              수집 {fmtTime(data.collectedAt)}
              {data.cacheHit && ' · 캐시'}
            </span>
          </div>
        )}
      </div>

      {/* Filters */}
      {loaded && !error && (
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'LOW', 'MEDIUM', 'HIGH'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRiskFilter(r)}
              aria-pressed={riskFilter === r}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                riskFilter === r
                  ? 'border-violet-500 bg-violet-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300'
              }`}
            >
              {r === 'ALL' ? '전체' : r}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-200" aria-hidden="true" />
          {(
            [
              { key: 'score' as const, label: '점수순' },
              { key: 'mention' as const, label: '언급↑' },
              { key: 'sentiment' as const, label: '긍정↑' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              aria-pressed={sortBy === key}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                sortBy === key
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFomoOnly((v) => !v)}
            aria-pressed={fomoOnly}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
              fomoOnly
                ? 'border-orange-400 bg-orange-50 text-orange-700'
                : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            FOMO만
          </button>
        </div>
      )}

      {!loaded && (
        <div
          role="status"
          aria-label="커뮤니티 데이터 로딩 중"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {loaded && error && (
        <p className="rounded-xl border border-gray-200 bg-white py-8 text-center text-sm text-gray-400">
          커뮤니티 데이터를 불러오지 못했어요.
        </p>
      )}

      {loaded && !error && filtered.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
          필터 조건에 맞는 종목이 없어요.
        </p>
      )}

      {loaded && !error && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <CommunityStockCard
              key={item.ticker}
              item={item}
              onClick={() => setSelected(item)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        Community Score = 감정(40%) + 언급증가(30%) + 거래량(20%) + 트렌드키워드(10%) ·
        종토방 50% / 디시 30% / 에펨 20% 가중 · 1시간마다 수집(캐시)
      </p>

      {selected && (
        <CommunityDetailModal item={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
