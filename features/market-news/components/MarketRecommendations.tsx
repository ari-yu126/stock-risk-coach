'use client';

import { useState, useEffect, useMemo } from 'react';
import { MOCK_BRIEFING } from '../lib/mock-news';
import { RiskBadge } from '../../watchlist/components/RiskBadge';
import type { AttentionLevel, RiskLevel } from '../../watchlist/types';
import type { MarketBriefing, MarketSentiment, RecommendationAction } from '../types';
import type { CandidatesResponse } from '@/app/api/candidates/route';
import type { StockCandidate, CandidateScoreBreakdown, JudgmentLabel } from '../lib/candidateDiscovery';
import type { MarketDataProviderType } from '@/features/market-data/lib/providers/types';
import type { DetectedTheme } from '../lib/themeDetection';

// ── Type aliases & constants ───────────────────────────────────────────────────

type SortKey = 'score' | 'volume' | 'price' | 'news';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',  label: '종합점수' },
  { key: 'volume', label: '거래량↑'  },
  { key: 'price',  label: '가격변동'  },
  { key: 'news',   label: '뉴스건수'  },
];

const RISK_LEVELS: RiskLevel[] = ['낮음', '보통', '높음', '위험'];

const JUDGMENT_LABELS: JudgmentLabel[] = [
  '오늘 관심 후보', '조금 더 지켜보기', '방향 애매함', '지금 접근 위험',
];

// ── Style maps ─────────────────────────────────────────────────────────────────

const MARKET_SENTIMENT_LABEL: Record<MarketSentiment, string> = {
  bullish: '강세', bearish: '약세', mixed: '혼조',
};

const MARKET_SENTIMENT_STYLE: Record<MarketSentiment, { dot: string; text: string; badge: string }> = {
  bullish: { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'bg-emerald-50 border-emerald-200' },
  bearish: { dot: 'bg-red-500',     text: 'text-red-700',     badge: 'bg-red-50 border-red-200' },
  mixed:   { dot: 'bg-yellow-500',  text: 'text-yellow-700',  badge: 'bg-yellow-50 border-yellow-200' },
};

const ACTION_STYLE: Record<RecommendationAction, { bg: string; border: string; label: string; icon: string }> = {
  '오늘 관심 후보':   { bg: 'bg-blue-50',   border: 'border-blue-300',   label: 'text-blue-700',   icon: '👀' },
  '조금 더 지켜보기': { bg: 'bg-amber-50',  border: 'border-amber-300',  label: 'text-amber-700',  icon: '⏳' },
  '방향 애매함':      { bg: 'bg-slate-50',  border: 'border-slate-300',  label: 'text-slate-600',  icon: '💭' },
  '지금 접근 위험':   { bg: 'bg-red-50',    border: 'border-red-300',    label: 'text-red-700',    icon: '⛔' },
};

const ATTENTION_STYLE: Record<AttentionLevel, { badge: string; dot: string }> = {
  '관찰중':  { badge: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-400' },
  '주의':    { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  '경계':    { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  '위험신호': { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500' },
};

const CAUTION_BORDER: Record<RiskLevel, string> = {
  '낮음': 'border-l-emerald-400',
  '보통': 'border-l-yellow-400',
  '높음': 'border-l-orange-400',
  '위험': 'border-l-red-500',
};

const SENTIMENT_KO: Record<string, string> = {
  positive: '상승 우세', negative: '하락 우세', neutral: '혼조',
};

const MARKET_PROVIDER_LABEL: Record<MarketDataProviderType, string> = {
  'naver-finance': '네이버 금융', 'mock': '샘플',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('ko-KR'); }

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function sortCandidates(list: StockCandidate[], key: SortKey): StockCandidate[] {
  return [...list].sort((a, b) => {
    switch (key) {
      case 'score':  return b.candidateScore - a.candidateScore;
      case 'volume': return b.scoreBreakdown.volumeRatio - a.scoreBreakdown.volumeRatio;
      case 'price':  return Math.abs(b.stock.changePercent) - Math.abs(a.stock.changePercent);
      case 'news':   return b.matchedTheme.newsCount - a.matchedTheme.newsCount;
    }
  });
}

function deriveMood(candidates: StockCandidate[]): { label: string; cls: string } {
  if (candidates.length === 0) return { label: '중립', cls: 'text-gray-500' };
  const rising = candidates.filter((c) => c.stock.changePercent > 0).length;
  const ratio = rising / candidates.length;
  if (ratio >= 0.6) return { label: '상승 우세', cls: 'text-red-600' };  // Korean convention: red = up
  if (ratio <= 0.4) return { label: '하락 우세', cls: 'text-blue-600' };
  return { label: '혼조', cls: 'text-gray-500' };
}

// ── Provider badges ────────────────────────────────────────────────────────────

function ProviderBadges({
  newsType, marketType, fetchedAt,
}: {
  newsType: 'naver' | 'mock';
  marketType: MarketDataProviderType;
  fetchedAt: string | null;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {newsType === 'naver' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />실제 뉴스
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />샘플 뉴스
          </span>
        )}
        {marketType === 'naver-finance' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" aria-hidden="true" />{MARKET_PROVIDER_LABEL[marketType]}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />마켓 {MARKET_PROVIDER_LABEL[marketType]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        {fetchedAt && <span>업데이트 {fmtTime(fetchedAt)}</span>}
        {marketType === 'naver-finance' && (
          <>{fetchedAt && <span>·</span>}<span>네이버 금융 비공식 데이터 · 지연/오차 가능</span></>
        )}
      </div>
    </div>
  );
}

// ── Summary bar ────────────────────────────────────────────────────────────────

function SummaryBar({
  topTheme, displayCount, totalCount, mood,
}: {
  topTheme: DetectedTheme | null;
  displayCount: number;
  totalCount: number;
  mood: { label: string; cls: string };
}) {
  return (
    // top-16 = 64px, sits just under the site header (≈73px) — adjust if needed
    <div className="sticky top-16 z-[9] -mx-4 mb-4 border-y border-gray-100 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {topTheme && (
          <span className="flex items-center gap-1.5 font-medium text-gray-800">
            <span className="text-base">🔥</span>
            <span>{topTheme.name}</span>
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
              강도 {topTheme.strengthScore}
            </span>
          </span>
        )}
        <span className="text-gray-300" aria-hidden="true">|</span>
        <span className="text-gray-600">
          후보 <span className="font-semibold text-gray-900">{displayCount}</span>
          {displayCount !== totalCount && (
            <span className="text-gray-400"> / {totalCount}</span>
          )}
          종목
        </span>
        <span className="text-gray-300" aria-hidden="true">|</span>
        <span className={`font-medium ${mood.cls}`}>{mood.label}</span>
      </div>
    </div>
  );
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? 'border-blue-500 bg-blue-500 text-white'
          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {children}
    </button>
  );
}

// ── Filter panel ───────────────────────────────────────────────────────────────

function FilterPanel({
  availableThemes, filterTheme, filterRisk, filterJudgment,
  setFilterTheme, setFilterRisk, setFilterJudgment,
}: {
  availableThemes: { id: string; name: string }[];
  filterTheme: string | null;
  filterRisk: RiskLevel | null;
  filterJudgment: JudgmentLabel | null;
  setFilterTheme: (v: string | null) => void;
  setFilterRisk: (v: RiskLevel | null) => void;
  setFilterJudgment: (v: JudgmentLabel | null) => void;
}) {
  return (
    <div id="candidate-filter-panel" className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      {/* Theme */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-7 shrink-0 text-[11px] font-semibold text-gray-400">테마</span>
        <FilterChip active={filterTheme === null} onClick={() => setFilterTheme(null)}>전체</FilterChip>
        {availableThemes.map((t) => (
          <FilterChip key={t.id} active={filterTheme === t.id} onClick={() => setFilterTheme(t.id)}>{t.name}</FilterChip>
        ))}
      </div>

      {/* Risk */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-7 shrink-0 text-[11px] font-semibold text-gray-400">위험</span>
        <FilterChip active={filterRisk === null} onClick={() => setFilterRisk(null)}>전체</FilterChip>
        {RISK_LEVELS.map((level) => (
          <FilterChip key={level} active={filterRisk === level} onClick={() => setFilterRisk(level)}>{level}</FilterChip>
        ))}
      </div>

      {/* Judgment */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-7 shrink-0 text-[11px] font-semibold text-gray-400">판단</span>
        <FilterChip active={filterJudgment === null} onClick={() => setFilterJudgment(null)}>전체</FilterChip>
        {JUDGMENT_LABELS.map((label) => (
          <FilterChip key={label} active={filterJudgment === label} onClick={() => setFilterJudgment(label)}>
            <span aria-hidden="true">{ACTION_STYLE[label].icon}</span> {label}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

// ── Score bar + detail ─────────────────────────────────────────────────────────

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.round((value / max) * 100)}%` }} />
      </div>
      <span className="w-12 text-right tabular-nums">{value} / {max}</span>
    </div>
  );
}

function ScoreDetail({ breakdown }: { breakdown: CandidateScoreBreakdown }) {
  const rows: { label: string; value: number; max: number; color: string; detail: string }[] = [
    { label: '테마 강도',    value: breakdown.themeScore,  max: 40, color: 'bg-blue-400',    detail: '뉴스 빈도 × 0.4' },
    { label: '거래량',       value: breakdown.volumeScore, max: 25, color: 'bg-violet-400',   detail: `${breakdown.volumeRatio.toFixed(2)}× 평균` },
    { label: '가격 변동',    value: breakdown.priceScore,  max: 15, color: 'bg-orange-400',   detail: '|등락률| 기준' },
    { label: '거래대금',     value: breakdown.tvScore,     max: 10, color: 'bg-teal-400',     detail: '억원 단위' },
    { label: '리스크 접근성', value: breakdown.riskScore,   max: 10, color: 'bg-emerald-400',  detail: '낮음/보통 → 10pt' },
  ];
  return (
    <div className="space-y-2 rounded-lg bg-gray-50 p-3 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-2">
          <div className="w-24 shrink-0 text-gray-500">{row.label}</div>
          <div className="min-w-0 flex-1 text-gray-400">{row.detail}</div>
          <ScoreBar value={row.value} max={row.max} color={row.color} />
        </div>
      ))}
      <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 font-semibold text-gray-700">
        <span>합계</span>
        <span className="tabular-nums">{breakdown.total} / 100</span>
      </div>
    </div>
  );
}

// ── Briefing card ──────────────────────────────────────────────────────────────

function BriefingCard({ briefing }: { briefing: MarketBriefing }) {
  const s = MARKET_SENTIMENT_STYLE[briefing.overallSentiment];
  const label = MARKET_SENTIMENT_LABEL[briefing.overallSentiment];
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${s.badge}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-500">{formatDate(briefing.date)} 시장 요약</p>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.badge} ${s.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />{label}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-700">{briefing.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {briefing.keyThemes.map((theme) => (
          <span key={theme} className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-xs text-gray-600">
            {theme}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Compact candidate row ──────────────────────────────────────────────────────

function CompactCandidateRow({ candidate }: { candidate: StockCandidate }) {
  const { stock, riskScore, judgmentLabel, candidateScore } = candidate;
  const isUp = stock.changePercent >= 0;
  const action = ACTION_STYLE[judgmentLabel];
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50 transition-colors">
      {/* Name + sector */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{stock.name}</p>
        <p className="text-xs text-gray-400">{stock.sector} · {stock.marketType}</p>
      </div>
      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium text-gray-900">{fmt(stock.price)}</p>
        <p className={`text-xs font-semibold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(1)}%
        </p>
      </div>
      {/* Judgment */}
      <span className={`hidden shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium sm:inline-flex items-center gap-1 ${action.bg} ${action.border} ${action.label}`}>
        <span aria-hidden="true">{action.icon}</span> {judgmentLabel}
      </span>
      {/* Risk */}
      <div className="shrink-0">
        <RiskBadge level={riskScore.level} />
      </div>
      {/* Score */}
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-600">
        {candidateScore}점
      </span>
    </div>
  );
}

// ── Full candidate card ────────────────────────────────────────────────────────

function CandidateCard({ candidate }: { candidate: StockCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const { stock, riskScore, matchedTheme, scoreBreakdown, matchConfidence, judgmentLabel, judgmentExplanation, discoveryReason, cautionReason } = candidate;
  const isLowConfidence = matchConfidence < 50;
  const isUp = stock.changePercent >= 0;
  const action = ACTION_STYLE[judgmentLabel];
  const attn = ATTENTION_STYLE[riskScore.attentionLevel];

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* 1. Header */}
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <p className="font-semibold text-gray-900">{stock.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            {stock.sector} · {stock.marketType}
            {stock.priceSource === 'mock' && (
              <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700">샘플가격</span>
            )}
            {stock.priceSource === 'naver-finance-polling' && (
              <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-600">네이버(Q)</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <p className="text-base font-bold text-gray-900">
            {fmt(stock.price)}<span className="ml-0.5 text-xs font-normal text-gray-400">원</span>
          </p>
          <p className={`text-xs font-semibold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{stock.changePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 2. Judgment */}
      <div className={`mx-5 mt-4 rounded-xl border-2 px-4 py-3.5 ${action.bg} ${action.border}`}>
        <p className={`flex items-center gap-2 text-base font-bold ${action.label}`}>
          <span aria-hidden="true">{action.icon}</span>{judgmentLabel}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{judgmentExplanation}</p>
      </div>

      {/* 3. Theme signal */}
      <div className="px-5 pt-4 pb-1">
        <div className="mb-1 flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-400">감지된 테마 · {matchedTheme.name}</p>
          {isLowConfidence && (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 border border-orange-200">
              연관성 낮음 · 참고만
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-gray-700">{matchedTheme.representativeHeadline}</p>
        <p className="mt-1.5 text-xs text-gray-400">{discoveryReason}</p>
      </div>

      {/* 4. Risk level */}
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 px-5 py-3">
        <span className="text-xs text-gray-400">위험 수준</span>
        <RiskBadge level={riskScore.level} />
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${attn.badge}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${attn.dot}`} aria-hidden="true" />{riskScore.attentionLevel}
        </span>
        <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold tabular-nums text-gray-600">
          {candidate.candidateScore}점
        </span>
      </div>

      {/* 5. Collapsible score detail */}
      <div className="border-t border-gray-100 px-5 py-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`score-detail-${stock.ticker}`}
          className="flex w-full items-center justify-between py-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
        >
          <span>선정 근거 상세</span>
          <span aria-hidden="true" className="text-lg leading-none">{expanded ? '−' : '+'}</span>
        </button>
        {expanded && (
          <div id={`score-detail-${stock.ticker}`} className="mb-2 mt-2 space-y-3">
            <div className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">매칭 테마</span><span className="font-medium text-gray-700">{matchedTheme.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">테마 강도</span><span className="font-medium text-gray-700">{matchedTheme.strengthScore} / 100</span></div>
              <div className="flex justify-between"><span className="text-gray-500">뉴스 감성</span><span className="font-medium text-gray-700">{SENTIMENT_KO[matchedTheme.sentimentSummary]}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">관련 기사</span><span className="font-medium text-gray-700">{matchedTheme.newsCount}건</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">매칭 신뢰도</span>
                <span className={`font-medium ${matchConfidence >= 70 ? 'text-green-600' : matchConfidence >= 50 ? 'text-amber-600' : 'text-orange-600'}`}>
                  {matchConfidence}%{isLowConfidence ? ' · 연관성 낮음' : ''}
                </span>
              </div>
            </div>
            <div className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">거래량 비율</span><span className="font-medium text-gray-700">{scoreBreakdown.volumeRatio.toFixed(2)}× 평균</span></div>
              <div className="flex justify-between"><span className="text-gray-500">가격 변동</span>
                <span className={`font-medium ${stock.changePercent >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                  {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between"><span className="text-gray-500">거래대금</span><span className="font-medium text-gray-700">{fmt(stock.tradingValue)}억원</span></div>
              <div className="flex justify-between"><span className="text-gray-500">시가총액</span><span className="font-medium text-gray-700">{fmt(Math.round(stock.marketCapBillion / 10))}억원</span></div>
            </div>
            <ScoreDetail breakdown={scoreBreakdown} />
          </div>
        )}
      </div>

      {/* 6. Caution footer */}
      <div className={`rounded-b-xl border-l-4 bg-gray-50 px-5 py-3 ${CAUTION_BORDER[riskScore.level]}`}>
        <p className="text-xs leading-relaxed text-gray-500">{cautionReason}</p>
      </div>
    </div>
  );
}

// ── Skeleton card ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="flex justify-between px-5 pt-5">
        <div className="space-y-1.5"><div className="h-4 w-20 rounded bg-gray-100" /><div className="h-3 w-16 rounded bg-gray-100" /></div>
        <div className="flex flex-col items-end space-y-1.5"><div className="h-5 w-20 rounded bg-gray-100" /><div className="h-3 w-10 rounded bg-gray-100" /></div>
      </div>
      <div className="mx-5 mt-4 h-20 rounded-xl bg-gray-100" />
      <div className="space-y-1.5 px-5 pt-4"><div className="h-3 w-24 rounded bg-gray-100" /><div className="h-4 w-full rounded bg-gray-100" /><div className="h-3 w-3/4 rounded bg-gray-100" /></div>
      <div className="mt-3 h-10 border-t border-gray-100 mx-5" />
      <div className="h-10 border-t border-gray-100 mx-5" />
      <div className="h-12 rounded-b-xl bg-gray-50" />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function MarketRecommendations() {
  const [candidates, setCandidates] = useState<StockCandidate[]>([]);
  const [newsProviderType, setNewsProviderType] = useState<'naver' | 'mock'>('mock');
  const [marketProviderType, setMarketProviderType] = useState<MarketDataProviderType>('mock');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Controls
  const [sortBy, setSortBy] = useState<SortKey>('score');
  const [showFilters, setShowFilters] = useState(false);
  const [filterTheme, setFilterTheme] = useState<string | null>(null);
  const [filterRisk, setFilterRisk] = useState<RiskLevel | null>(null);
  const [filterJudgment, setFilterJudgment] = useState<JudgmentLabel | null>(null);
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/candidates')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CandidatesResponse>; })
      .then((data) => {
        if (!cancelled) {
          setCandidates(data.candidates);
          setNewsProviderType(data.newsProviderType);
          setMarketProviderType(data.marketProviderType);
          setFetchedAt(data.fetchedAt);
          setLoaded(true);
        }
      })
      .catch(() => { if (!cancelled) { setError(true); setLoaded(true); } });
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────

  const availableThemes = useMemo(() => {
    const seen = new Set<string>();
    return candidates
      .map((c) => ({ id: c.matchedTheme.id, name: c.matchedTheme.name }))
      .filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });
  }, [candidates]);

  const sortedFiltered = useMemo(() => {
    let result = [...candidates];
    if (filterTheme)   result = result.filter((c) => c.matchedTheme.id === filterTheme);
    if (filterRisk)    result = result.filter((c) => c.riskScore.level === filterRisk);
    if (filterJudgment) result = result.filter((c) => c.judgmentLabel === filterJudgment);
    return sortCandidates(result, sortBy);
  }, [candidates, sortBy, filterTheme, filterRisk, filterJudgment]);

  const topTheme = useMemo(() => candidates.reduce<DetectedTheme | null>(
    (best, c) => !best || c.matchedTheme.strengthScore > best.strengthScore ? c.matchedTheme : best,
    null,
  ), [candidates]);

  const mood = useMemo(() => deriveMood(candidates), [candidates]);

  const hasActiveFilter = filterTheme !== null || filterRisk !== null || filterJudgment !== null;

  return (
    <div className="space-y-6">

      {/* 오늘 시장 브리핑 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">오늘 시장 브리핑</h2>
        <BriefingCard briefing={MOCK_BRIEFING} />
      </section>

      {/* 오늘 주목 종목 */}
      <section>
        {/* Section header */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">오늘 주목 종목</h2>
            <p className="text-sm text-gray-500">뉴스 테마 · 거래량 · 가격 신호 기반 자동 선정</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loaded && !error && (
              <ProviderBadges newsType={newsProviderType} marketType={marketProviderType} fetchedAt={fetchedAt} />
            )}
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400">
              참고용 · 매매 추천 아님
            </span>
          </div>
        </div>

        {/* Loading skeletons */}
        {!loaded && (
          <div role="status" aria-label="후보 종목 로딩 중" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error state */}
        {loaded && error && (
          <p className="rounded-xl border border-gray-200 bg-white py-10 text-center text-sm text-gray-400">
            후보 종목을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
          </p>
        )}

        {/* Empty state */}
        {loaded && !error && candidates.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-500">오늘은 뚜렷한 신호가 감지된 종목이 없어요</p>
            <p className="mt-1 text-xs text-gray-400">뉴스 테마가 형성되거나 거래량 신호가 나타나면 자동으로 표시돼요.</p>
          </div>
        )}

        {/* Loaded with candidates */}
        {loaded && !error && candidates.length > 0 && (
          <>
            {/* Sticky summary bar */}
            <SummaryBar
              topTheme={topTheme}
              displayCount={sortedFiltered.length}
              totalCount={candidates.length}
              mood={mood}
            />

            {/* Sort + view controls */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              {/* Sort pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-400">정렬</span>
                <div className="flex gap-1">
                  {SORT_OPTIONS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setSortBy(key)}
                      aria-pressed={sortBy === key}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        sortBy === key
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-blue-300 hover:text-blue-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter + view toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  aria-controls="candidate-filter-panel"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    showFilters || hasActiveFilter
                      ? 'border-violet-400 bg-violet-50 text-violet-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-violet-300 hover:text-violet-600'
                  }`}
                >
                  {/* Filter icon */}
                  <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M2 4h12M5 8h6M7 12h2" />
                  </svg>
                  필터{hasActiveFilter && <span aria-hidden="true"> ●</span>}
                </button>

                <button
                  onClick={() => setCompactMode((v) => !v)}
                  aria-label={compactMode ? '카드 보기' : '목록 보기'}
                  className={`rounded-full border p-1.5 transition-colors ${
                    compactMode
                      ? 'border-gray-400 bg-gray-100 text-gray-700'
                      : 'border-gray-200 bg-white text-gray-400 hover:border-gray-400 hover:text-gray-600'
                  }`}
                >
                  {compactMode ? (
                    /* Grid icon */
                    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="1" y="1" width="6" height="6" rx="1.5" />
                      <rect x="9" y="1" width="6" height="6" rx="1.5" />
                      <rect x="1" y="9" width="6" height="6" rx="1.5" />
                      <rect x="9" y="9" width="6" height="6" rx="1.5" />
                    </svg>
                  ) : (
                    /* List icon */
                    <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M2 4h12M2 8h12M2 12h12" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
              <FilterPanel
                availableThemes={availableThemes}
                filterTheme={filterTheme}
                filterRisk={filterRisk}
                filterJudgment={filterJudgment}
                setFilterTheme={setFilterTheme}
                setFilterRisk={setFilterRisk}
                setFilterJudgment={setFilterJudgment}
              />
            )}

            {/* No results after filter */}
            {sortedFiltered.length === 0 && (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-8 text-center">
                <p className="text-sm text-gray-400">선택한 필터에 해당하는 종목이 없어요.</p>
                <button
                  onClick={() => { setFilterTheme(null); setFilterRisk(null); setFilterJudgment(null); }}
                  className="mt-2 text-xs text-blue-500 underline"
                >
                  필터 초기화
                </button>
              </div>
            )}

            {/* Candidate list */}
            {sortedFiltered.length > 0 && (
              compactMode ? (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  {sortedFiltered.map((c) => <CompactCandidateRow key={c.stock.ticker} candidate={c} />)}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {sortedFiltered.map((c) => <CandidateCard key={c.stock.ticker} candidate={c} />)}
                </div>
              )
            )}
          </>
        )}
      </section>
    </div>
  );
}
