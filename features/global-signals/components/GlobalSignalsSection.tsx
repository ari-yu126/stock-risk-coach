'use client';

import { useState, useEffect } from 'react';
import { ShowMoreList } from '@/components/ui/ShowMoreList';
import type { GlobalSignal, GlobalSignalsResponse, SignalImpact } from '../types';

const SIGNAL_INITIAL_COUNT = 3;

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Impact metadata (Korean convention: red = up/positive, blue = down/negative) ──

const IMPACT_META: Record<SignalImpact, {
  label: string;
  arrow: string;
  borderCls: string;
  badgeCls: string;
  arrowCls: string;
}> = {
  positive: {
    label: '호재',
    arrow: '▲',
    borderCls: 'border-l-red-400',
    badgeCls: 'bg-red-50 text-red-700 border-red-200',
    arrowCls: 'text-red-500',
  },
  negative: {
    label: '악재',
    arrow: '▼',
    borderCls: 'border-l-blue-400',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
    arrowCls: 'text-blue-500',
  },
  neutral: {
    label: '중립',
    arrow: '─',
    borderCls: 'border-l-gray-300',
    badgeCls: 'bg-gray-100 text-gray-600 border-gray-200',
    arrowCls: 'text-gray-400',
  },
};

const SECTOR_BADGE_CLS: Record<string, string> = {
  ai:          'bg-violet-50 text-violet-700 border-violet-200',
  semiconductor:'bg-blue-50 text-blue-700 border-blue-200',
  battery:     'bg-green-50 text-green-700 border-green-200',
  biotech:     'bg-teal-50 text-teal-700 border-teal-200',
  energy:      'bg-orange-50 text-orange-700 border-orange-200',
  fed_rates:   'bg-amber-50 text-amber-700 border-amber-200',
  nasdaq:      'bg-slate-100 text-slate-600 border-slate-200',
};

function sectorBadgeCls(sector: string): string {
  return SECTOR_BADGE_CLS[sector] ?? 'bg-gray-100 text-gray-600 border-gray-200';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ProviderBadge({ providerType }: { providerType: 'finnhub' | 'mock' }) {
  if (providerType === 'finnhub') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
        Finnhub 실시간
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
      샘플 데이터
    </span>
  );
}

function SignalRow({ signal }: { signal: GlobalSignal }) {
  const impact = IMPACT_META[signal.impact];

  return (
    <div className={`flex gap-0 border-b border-gray-100 last:border-0`}>
      {/* Left impact bar */}
      <div className={`w-1 shrink-0 rounded-l-lg border-l-4 ${impact.borderCls} bg-transparent`} aria-hidden="true" />

      <div className="flex-1 px-4 py-3.5">
        {/* Row 1: sector + impact badges */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${sectorBadgeCls(signal.sector)}`}>
            {signal.sectorLabel}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold ${impact.badgeCls}`}>
            <span className={impact.arrowCls}>{impact.arrow}</span> {impact.label}
          </span>
        </div>

        {/* Row 2: title */}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">
          {signal.title}
        </p>

        {/* Row 3: summary */}
        {signal.summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
            {signal.summary}
          </p>
        )}

        {/* Row 4: related Korean tickers */}
        {signal.relatedTickers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-gray-400">관련 한국 종목</span>
            {signal.relatedTickers.map((ticker) => (
              <span
                key={ticker}
                className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600"
              >
                {ticker}
              </span>
            ))}
          </div>
        )}

        {/* Row 5: source + time */}
        <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-400">
          <span>{signal.source}</span>
          <span>·</span>
          <span>{formatRelativeTime(signal.publishedAt)}</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-0 border-b border-gray-100 last:border-0 animate-pulse">
      <div className="w-1 shrink-0 rounded-l-lg bg-gray-200" />
      <div className="flex-1 px-4 py-3.5 space-y-2">
        <div className="flex gap-1.5">
          <div className="h-4 w-14 rounded bg-gray-100" />
          <div className="h-4 w-10 rounded bg-gray-100" />
        </div>
        <div className="h-4 w-4/5 rounded bg-gray-100" />
        <div className="h-3 w-full rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ── Sector filter pill labels ──────────────────────────────────────────────────

const FILTER_ALL = '전체' as const;

// ── Main export ────────────────────────────────────────────────────────────────

export function GlobalSignalsSection() {
  const [response, setResponse] = useState<GlobalSignalsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_ALL);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/global-signals')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GlobalSignalsResponse>;
      })
      .then((data) => {
        if (!cancelled) { setResponse(data); setLoaded(true); }
      })
      .catch(() => {
        if (!cancelled) { setError(true); setLoaded(true); }
      });

    return () => { cancelled = true; };
  }, []);

  // Derive unique sectors from loaded signals for filter pills
  const availableSectors = response
    ? Array.from(new Map(response.signals.map((s) => [s.sector, s.sectorLabel])).entries())
    : [];

  const filtered = response?.signals.filter(
    (s) => activeFilter === FILTER_ALL || s.sector === activeFilter,
  ) ?? [];

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">해외 시장 신호</h2>
          <p className="text-sm text-gray-500">미국/글로벌 뉴스 → 한국 섹터 영향 분석</p>
        </div>
        {loaded && !error && response && (
          <div className="flex flex-col items-end gap-1">
            <ProviderBadge providerType={response.providerType} />
            <span className="text-[11px] text-gray-400">
              업데이트 {fmtTime(response.fetchedAt)}
            </span>
          </div>
        )}
      </div>

      {/* Sector filter pills */}
      {loaded && !error && availableSectors.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter(FILTER_ALL)}
            aria-pressed={activeFilter === FILTER_ALL}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              activeFilter === FILTER_ALL
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            전체
          </button>
          {availableSectors.map(([sector, label]) => (
            <button
              key={sector}
              onClick={() => setActiveFilter(sector)}
              aria-pressed={activeFilter === sector}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                activeFilter === sector
                  ? 'border-blue-500 bg-blue-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Signal list */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {!loaded && (
          <div role="status" aria-label="해외 시장 신호 로딩 중">
            {Array.from({ length: SIGNAL_INITIAL_COUNT }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        )}

        {loaded && error && (
          <p className="py-10 text-center text-sm text-gray-400">
            해외 시장 신호를 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        )}

        {loaded && !error && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">
            해당 섹터의 신호가 없어요.
          </p>
        )}

        {loaded && !error && filtered.length > 0 && (
          <ShowMoreList
            items={filtered}
            limit={SIGNAL_INITIAL_COUNT}
            resetKey={activeFilter}
            getItemKey={(signal) => signal.id}
            moreLabel={(n) => `더보기 (${n}건)`}
            renderItem={(signal) => <SignalRow signal={signal} />}
          />
        )}
      </div>

      {/* Disclaimer */}
      <p className="mt-2 text-[11px] text-gray-400">
        규칙 기반 분류 · 영향도는 참고용이며 실제 주가 움직임을 보장하지 않습니다.
      </p>
    </section>
  );
}
