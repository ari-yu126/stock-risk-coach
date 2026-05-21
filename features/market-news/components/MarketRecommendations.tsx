'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTodayBriefing } from '../lib/mock-news';
import { buildBriefingFromNews } from '../lib/briefingFromNews';
import type { NewsResponse } from '../lib/providers/types';
import { RiskBadge } from '../../watchlist/components/RiskBadge';
import { Sparkline } from '../../watchlist/components/Sparkline';
import { getIntradaySeries } from '../../watchlist/lib/intradayData';
import type { AttentionLevel, RiskLevel } from '../../watchlist/types';
import type { MarketBriefing, MarketSentiment, RecommendationAction } from '../types';
import type { CandidatesResponse } from '@/app/api/candidates/route';
import type { StockCandidate, CandidateScoreBreakdown, JudgmentLabel } from '../lib/candidateDiscovery';
import { generateCandidateNarrative } from '../lib/candidateDiscovery';
import type { MarketDataProviderType } from '@/features/market-data/lib/providers/types';
import type { DetectedTheme } from '../lib/themeDetection';
import { calcFreshness, calcAgeMinutes } from '../lib/themeDetection';
import { getNotificationSettings, sendWatchlistNotification } from '../../watchlist/lib/notifications';
import { loadTickers } from '../../watchlist/lib/storage';
import { enrichWithFlowScores, type FlowEnrichmentContext } from '../lib/candidateDiscovery';
import { analyzeSectorRotation, type SectorRotationResult } from '../lib/sectorRotation';
import { analyzeMomentum, loadSnapshots } from '../../watchlist/lib/momentumHistory';
import { detectFomo } from '../../watchlist/lib/fomoDetection';

// ── Freshness display helpers ─────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const minutes = calcAgeMinutes(iso);
  if (minutes < 1)    return '방금 전';
  if (minutes < 60)   return `${Math.round(minutes)}분 전`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}시간 전`;
  return `${Math.round(minutes / 1440)}일 전`;
}

function freshnessOpacity(iso: string): string {
  const score = calcFreshness(iso);
  if (score >= 0.75) return '';
  if (score >= 0.5)  return 'opacity-75';
  return 'opacity-50';
}

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

// ── Provider badges ────────────────────────────────────────────────────────────

function ProviderBadges({
  newsType, marketType, fetchedAt, showDisclaimer = false,
}: {
  newsType: 'naver' | 'mock';
  marketType: MarketDataProviderType;
  fetchedAt: string | null;
  showDisclaimer?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      {/* All chips in a single flex row — keeps every pill on the same baseline */}
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
        {showDisclaimer && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400">
            참고용 · 매매 추천 아님
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

// ── Today focus digest (news issue vs candidate pool — no overlapping labels) ───

function TodayFocusDigest({
  topTheme,
  candidates,
  displayCount,
  totalCount,
}: {
  topTheme: DetectedTheme | null;
  candidates: StockCandidate[];
  displayCount: number;
  totalCount: number;
}) {
  const rising = candidates.filter((c) => c.stock.changePercent > 0).length;
  const falling = candidates.filter((c) => c.stock.changePercent < 0).length;
  const avgChg =
    candidates.length > 0
      ? candidates.reduce((s, c) => s + c.stock.changePercent, 0) / candidates.length
      : 0;
  const chgSign = avgChg >= 0 ? '+' : '';

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs text-gray-500">
        뉴스 이슈와 선정된 종목은 <span className="font-medium text-gray-700">서로 다른 지표</span>예요.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            ① 오늘 뉴스 핵심 이슈
          </p>
          {topTheme ? (
            <>
              <p className="mt-2 text-base font-semibold text-gray-900">{topTheme.name}</p>
              <p className="mt-1 text-xs text-gray-600">
                뉴스 강도 <span className="font-semibold tabular-nums">{topTheme.strengthScore}</span>
                {' · '}관련 기사 <span className="font-semibold tabular-nums">{topTheme.newsCount}</span>건
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">
                {topTheme.representativeHeadline}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500">뚜렷한 뉴스 테마가 없어요.</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
            ② 자동 선정 후보 종목
          </p>
          <p className="mt-2 text-base font-semibold text-gray-900">
            총 <span className="tabular-nums">{totalCount}</span>종목
            {displayCount !== totalCount && (
              <span className="ml-1 text-sm font-normal text-gray-500">
                (필터 후 <span className="tabular-nums">{displayCount}</span>종목 표시)
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-gray-600">
            오늘 등락 —{' '}
            <span className="font-semibold text-red-600 tabular-nums">상승 {rising}</span>
            {' · '}
            <span className="font-semibold text-blue-600 tabular-nums">하락 {falling}</span>
            {' · '}
            평균 <span className={`font-semibold tabular-nums ${avgChg >= 0 ? 'text-red-600' : 'text-blue-600'}`}>
              {chgSign}{avgChg.toFixed(1)}%
            </span>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            뉴스·거래량·가격 신호로 골라낸 종목이며, 위 뉴스 이슈와 1:1로 같지는 않아요.
          </p>
        </div>
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
  const hasFlowData =
    breakdown.freshnessBonus !== 0 || breakdown.momentumBonus !== 0 ||
    breakdown.overheatPenalty !== 0 || breakdown.sectorLeaderBonus !== 0;
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
      {hasFlowData && (
        <div className="mt-3 border-t border-gray-200 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">흐름 보정</p>
          {[
            { label: '뉴스 신선도', val: breakdown.freshnessBonus,    show: breakdown.freshnessBonus    !== 0 },
            { label: '모멘텀',      val: breakdown.momentumBonus,     show: breakdown.momentumBonus     !== 0 },
            { label: '섹터 주도',   val: breakdown.sectorLeaderBonus, show: breakdown.sectorLeaderBonus  > 0 },
            { label: '과열 페널티', val: -breakdown.overheatPenalty,  show: breakdown.overheatPenalty    > 0 },
          ].filter((r) => r.show).map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <span className="w-24 shrink-0 text-gray-500">{r.label}</span>
              <span className={`ml-auto tabular-nums font-medium ${r.val > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {r.val > 0 ? '+' : ''}{r.val}pt
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 font-bold text-gray-700">
            <span>흐름 반영</span>
            <span className="tabular-nums">{breakdown.flowTotal} / 100</span>
          </div>
        </div>
      )}
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
  const [newsExpanded, setNewsExpanded] = useState(false);
  const {
    stock, riskScore, matchedTheme, scoreBreakdown, matchConfidence,
    judgmentLabel, judgmentExplanation, discoveryReason, cautionReason,
    matchedNewsHeadlines, matchedNewsSources, matchedNewsPublishedAt,
    matchedNewsKeywords, isForeignNewsInfluenced,
  } = candidate;
  const isLowConfidence = matchConfidence < 50;
  const isUp = stock.changePercent >= 0;
  const action = ACTION_STYLE[judgmentLabel];
  const attn = ATTENTION_STYLE[riskScore.attentionLevel];
  const series = getIntradaySeries(stock.ticker, stock.changePercent);
  const narrative = useMemo(() => generateCandidateNarrative(candidate), [candidate]);

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
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <Sparkline points={series.points} trend={series.trend} width={72} height={26} />
            <div className="text-right">
              <p className="text-base font-bold text-gray-900">
                {fmt(stock.price)}<span className="ml-0.5 text-xs font-normal text-gray-400">원</span>
              </p>
              <p className={`text-xs font-semibold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{stock.changePercent.toFixed(1)}%
              </p>
            </div>
          </div>
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
            {/* Analyst narrative */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-400">AI 분석</p>
              <p className="text-xs leading-relaxed text-blue-800">{narrative}</p>
            </div>
            <div className="space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">매칭 테마</span><span className="font-medium text-gray-700">{matchedTheme.name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">테마 강도</span><span className="font-medium text-gray-700">{matchedTheme.strengthScore} / 100</span></div>
              <div className="flex justify-between"><span className="text-gray-500">뉴스 신선도</span><span className="font-medium text-gray-700">{Math.round(matchedTheme.freshnessScore * 100)}%</span></div>
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

      {/* 6. Collapsible news trace */}
      {matchedNewsHeadlines.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-2">
          <button
            onClick={() => setNewsExpanded((v) => !v)}
            aria-expanded={newsExpanded}
            aria-controls={`news-trace-${stock.ticker}`}
            className="flex w-full items-center justify-between py-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600"
          >
            <span className="flex items-center gap-1.5">
              반영된 뉴스
              {isForeignNewsInfluenced && (
                <span className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600">
                  해외 영향
                </span>
              )}
            </span>
            <span aria-hidden="true" className="text-lg leading-none">{newsExpanded ? '−' : '+'}</span>
          </button>
          {newsExpanded && (
            <div id={`news-trace-${stock.ticker}`} className="mb-2 mt-2 space-y-2.5">
              {/* Matched keywords */}
              {matchedNewsKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {matchedNewsKeywords.map((kw) => (
                    <span key={kw} className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
                      {kw}
                    </span>
                  ))}
                </div>
              )}
              {/* Headline list with freshness */}
              <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs">
                {matchedNewsHeadlines.map((headline, i) => {
                  const publishedAt = matchedNewsPublishedAt[i];
                  const fadeCls = publishedAt ? freshnessOpacity(publishedAt) : '';
                  return (
                    <div key={i} className={`flex items-start gap-1.5 ${fadeCls}`}>
                      <div className="mt-0.5 flex shrink-0 flex-col gap-0.5">
                        <span className="rounded bg-gray-200 px-1 py-0.5 text-[10px] font-medium text-gray-500">
                          {matchedNewsSources[i]}
                        </span>
                        {publishedAt && (
                          <span className="text-[10px] text-gray-400">
                            {formatRelativeTime(publishedAt)}
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-2 leading-snug text-gray-700">{headline}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7. Caution footer */}
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

// ── Trading dashboard strip ───────────────────────────────────────────────────

function StripTile({ icon, label, value, sub, colorClass }: {
  icon: string; label: string; value: string; sub: string; colorClass: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl border p-3 ${colorClass}`}>
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide opacity-60">
        <span aria-hidden="true">{icon}</span>{label}
      </p>
      <p className="truncate text-sm font-bold">{value}</p>
      <p className="text-[11px] opacity-70">{sub}</p>
    </div>
  );
}

function TradingDashboardStrip({
  candidates, sectorRotation,
}: {
  candidates: StockCandidate[];
  sectorRotation: SectorRotationResult | null;
}) {
  if (candidates.length === 0) return null;
  const strongestFlow = [...candidates].sort((a, b) => b.scoreBreakdown.flowTotal - a.scoreBreakdown.flowTotal)[0];
  const topOverheat   = [...candidates]
    .filter((c) => c.scoreBreakdown.overheatPenalty > 0)
    .sort((a, b) => b.scoreBreakdown.overheatPenalty - a.scoreBreakdown.overheatPenalty)[0] ?? null;
  const topVolume = [...candidates].sort((a, b) => b.scoreBreakdown.volumeRatio - a.scoreBreakdown.volumeRatio)[0];
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StripTile
        icon="🔥" label="가장 강한 흐름"
        value={strongestFlow.stock.name}
        sub={`종합 ${strongestFlow.scoreBreakdown.flowTotal}점`}
        colorClass="border-orange-200 bg-orange-50 text-orange-800"
      />
      <StripTile
        icon="⚠️" label="과열 주의"
        value={topOverheat ? topOverheat.stock.name : '과열 없음'}
        sub={topOverheat ? `페널티 ${topOverheat.scoreBreakdown.overheatPenalty}pt` : '현재 정상'}
        colorClass={topOverheat ? 'border-red-200 bg-red-50 text-red-800' : 'border-gray-200 bg-gray-50 text-gray-500'}
      />
      <StripTile
        icon="📈" label="거래량 급증 TOP"
        value={topVolume.stock.name}
        sub={`${topVolume.scoreBreakdown.volumeRatio.toFixed(1)}배 거래량`}
        colorClass="border-blue-200 bg-blue-50 text-blue-800"
      />
      <StripTile
        icon="🔄" label="순환매"
        value={sectorRotation?.rotationSummary ?? '분석 중'}
        sub={sectorRotation ? `${sectorRotation.allSectors.length}개 섹터` : '데이터 없음'}
        colorClass="border-violet-200 bg-violet-50 text-violet-800"
      />
    </div>
  );
}

// ── Debug panel ───────────────────────────────────────────────────────────────

function DebugPanel({
  candidates, flowCtx, sectorRotation, fetchedAt,
}: {
  candidates: StockCandidate[];
  flowCtx: FlowEnrichmentContext;
  sectorRotation: SectorRotationResult;
  fetchedAt: string | null;
}) {
  return (
    <div className="mt-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 text-xs">
      <p className="mb-3 font-bold text-amber-700">🔍 진단 모드 (?debug=1)</p>

      <div className="mb-3">
        <p className="mb-1 font-semibold text-amber-600">메타</p>
        <p className="text-gray-700">fetchedAt: {fetchedAt ?? '없음'} · 후보 {candidates.length}개</p>
      </div>

      <div className="mb-3 overflow-x-auto">
        <p className="mb-1 font-semibold text-amber-600">점수 분해</p>
        <table className="min-w-full border-collapse font-mono text-[10px]">
          <thead>
            <tr className="text-gray-500">
              {['종목', '기본', '신선도', '모멘텀', '섹터', '과열', '흐름', '방향', 'FOMO'].map((h) => (
                <th key={h} className="px-1.5 py-0.5 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.stock.ticker} className="border-t border-amber-200 text-gray-700">
                <td className="px-1.5 py-0.5">{c.stock.ticker}</td>
                <td className="px-1.5 py-0.5 text-center">{c.scoreBreakdown.total}</td>
                <td className="px-1.5 py-0.5 text-center">{c.scoreBreakdown.freshnessBonus >= 0 ? '+' : ''}{c.scoreBreakdown.freshnessBonus}</td>
                <td className="px-1.5 py-0.5 text-center">{c.scoreBreakdown.momentumBonus >= 0 ? '+' : ''}{c.scoreBreakdown.momentumBonus}</td>
                <td className="px-1.5 py-0.5 text-center">+{c.scoreBreakdown.sectorLeaderBonus}</td>
                <td className="px-1.5 py-0.5 text-center">-{c.scoreBreakdown.overheatPenalty}</td>
                <td className="px-1.5 py-0.5 text-center font-bold">{c.scoreBreakdown.flowTotal}</td>
                <td className="px-1.5 py-0.5 text-center">{flowCtx.momentumDirections.get(c.stock.ticker) ?? '—'}</td>
                <td className="px-1.5 py-0.5 text-center">{flowCtx.fomoScores.get(c.stock.ticker) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-1 font-semibold text-amber-600">섹터 순환매 — {sectorRotation.rotationSummary}</p>
        <div className="space-y-0.5">
          {sectorRotation.allSectors.map((s) => (
            <div key={s.sector} className="flex gap-3 font-mono text-[10px] text-gray-700">
              <span className="w-14 shrink-0">{s.sector}</span>
              <span>vol×{s.avgVolumeRatio.toFixed(1)}</span>
              <span>{s.avgChangePercent >= 0 ? '+' : ''}{s.avgChangePercent.toFixed(1)}%</span>
              <span>str:{s.avgStrengthScore.toFixed(0)}</span>
              {sectorRotation.leadingSectors.some((ls) => ls.sector === s.sector) && (
                <span className="font-semibold text-orange-600">▲주도</span>
              )}
              {sectorRotation.weakeningSectors.some((ws) => ws.sector === s.sector) && (
                <span className="text-blue-500">▼약화</span>
              )}
            </div>
          ))}
        </div>
      </div>
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

  const [flowCtx, setFlowCtx] = useState<FlowEnrichmentContext | null>(null);
  const [sectorRotation, setSectorRotation] = useState<SectorRotationResult | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [briefing, setBriefing] = useState<MarketBriefing | null>(null);
  const [briefingLoaded, setBriefingLoaded] = useState(false);

  useEffect(() => {
    setDebugMode(new URLSearchParams(window.location.search).get('debug') === '1'); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/market-news')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<NewsResponse>; })
      .then((data) => {
        if (!cancelled) {
          setBriefing(buildBriefingFromNews(data.articles));
          setBriefingLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBriefing(getTodayBriefing());
          setBriefingLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/candidates')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<CandidatesResponse>; })
      .then((data) => {
        if (!cancelled) {
          // Flow enrichment: runs client-side using localStorage momentum snapshots
          const rotation = analyzeSectorRotation(data.candidates);
          const leadingSectorNames = new Set(rotation.leadingSectors.map((s) => s.sector));
          const momentumDirections = new Map<string, 'accelerating' | 'fading' | 'sideways'>();
          const fomoScoresMap = new Map<string, number>();
          for (const c of data.candidates) {
            const ticker = c.stock.ticker;
            const momentum = analyzeMomentum(ticker);
            momentumDirections.set(ticker, momentum.direction);
            const snaps = loadSnapshots(ticker);
            const fomo = detectFomo({
              ticker,
              volumeRatio: c.scoreBreakdown.volumeRatio,
              changePercent: c.stock.changePercent,
              newsCount: c.matchedTheme.newsCount,
              snapshots: snaps,
            });
            fomoScoresMap.set(ticker, fomo.score);
          }
          const ctx: FlowEnrichmentContext = {
            leadingSectorNames,
            momentumDirections,
            fomoScores: fomoScoresMap,
          };
          const enriched = enrichWithFlowScores(data.candidates, ctx);
          setCandidates(enriched);
          setFlowCtx(ctx);
          setSectorRotation(rotation);
          setNewsProviderType(data.newsProviderType);
          setMarketProviderType(data.marketProviderType);
          setFetchedAt(data.fetchedAt);
          setLoaded(true);
          // Fire notifications for watched stocks that are "오늘 관심 후보"
          const settings = getNotificationSettings();
          if (settings.enabled) {
            const watchedTickers = loadTickers();
            for (const c of enriched) {
              if (
                c.judgmentLabel === '오늘 관심 후보' &&
                watchedTickers.includes(c.stock.ticker)
              ) {
                sendWatchlistNotification(c.stock.ticker, c.stock.name, c.judgmentLabel);
              }
            }
          }
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

  const hasActiveFilter = filterTheme !== null || filterRisk !== null || filterJudgment !== null;

  return (
    <div className="space-y-6">

      {/* 오늘 시장 브리핑 — same /api/market-news feed as 뉴스 섹션 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">오늘 시장 브리핑</h2>
        {!briefingLoaded ? (
          <div
            role="status"
            aria-label="시장 브리핑 로딩 중"
            className="h-36 animate-pulse rounded-xl border border-gray-100 bg-white"
          />
        ) : (
          <BriefingCard briefing={briefing ?? getTodayBriefing()} />
        )}
      </section>

      {/* 오늘 주목 종목 */}
      <section>
        {/* Section header */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">오늘 주목 종목</h2>
            <p className="text-sm text-gray-500">뉴스·거래량·가격 신호로 자동 선정된 종목 목록</p>
          </div>
          {loaded && !error ? (
            <ProviderBadges
              newsType={newsProviderType}
              marketType={marketProviderType}
              fetchedAt={fetchedAt}
              showDisclaimer
            />
          ) : (
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-400">
              참고용 · 매매 추천 아님
            </span>
          )}
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
            <TodayFocusDigest
              topTheme={topTheme}
              candidates={candidates}
              displayCount={sortedFiltered.length}
              totalCount={candidates.length}
            />

            <TradingDashboardStrip candidates={candidates} sectorRotation={sectorRotation} />

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

            {/* Diagnostics panel — visible only with ?debug=1 */}
            {debugMode && flowCtx && sectorRotation && (
              <DebugPanel
                candidates={candidates}
                flowCtx={flowCtx}
                sectorRotation={sectorRotation}
                fetchedAt={fetchedAt}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
