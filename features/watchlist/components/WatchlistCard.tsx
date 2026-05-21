import { WatchlistItem, AttentionLevel, RiskLevel } from '../types';
import type { EntrySignalResult } from '../lib/entrySignalTypes';
import { RiskBadge } from './RiskBadge';
import { CardEntrySignals } from './CardEntrySignals';
import { detectSurgeSignals, type SurgeLevel } from '../lib/surgeDetection';
import { getIntradaySeries } from '../lib/intradayData';
import { Sparkline } from './Sparkline';

interface WatchlistCardProps {
  item: WatchlistItem;
  onRemove: (ticker: string) => void;
  entrySignals?: EntrySignalResult[];
  signalsLoading?: boolean;
}

const SURGE_BADGE: Record<Exclude<SurgeLevel, 'none'>, { bg: string; text: string; border: string }> = {
  medium:   { bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-300' },
  high:     { bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-300' },
  critical: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-400'    },
};

const SCORE_BAR_COLOR: Record<RiskLevel, string> = {
  '낮음': 'bg-emerald-500',
  '보통': 'bg-yellow-500',
  '높음': 'bg-orange-500',
  '위험': 'bg-red-500',
};

const ATTENTION_STYLES: Record<AttentionLevel, { badge: string; dot: string }> = {
  '관찰중': { badge: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-400' },
  '주의':   { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  '경계':   { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  '위험신호': { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
};

function fmt(n: number) {
  return n.toLocaleString('ko-KR');
}

function PriceSourceBadge({ source }: { source: string | undefined }) {
  if (!source) return null;
  if (source === 'naver-finance-primary') {
    return <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700">실시간(P)</span>;
  }
  if (source === 'naver-finance-polling') {
    return <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700">실시간(Q)</span>;
  }
  return <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700">샘플</span>;
}

export function WatchlistCard({ item, onRemove, entrySignals = [], signalsLoading }: WatchlistCardProps) {
  const { stock, riskScore } = item;
  const isUp = stock.changePercent >= 0;
  const attn = ATTENTION_STYLES[riskScore.attentionLevel];
  const surge = detectSurgeSignals(stock);
  const series = getIntradaySeries(stock.ticker, stock.changePercent);

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-start justify-between px-5 pt-5">
        <div>
          <p className="text-base font-semibold text-gray-900">{stock.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            {stock.ticker} · {stock.sector}
            <PriceSourceBadge source={stock.priceSource} />
          </p>
        </div>
        <button
          onClick={() => onRemove(stock.ticker)}
          className="rounded-md p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500"
          aria-label="삭제"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* ── Surge badges ── */}
      {surge.level !== 'none' && (
        <div className="mt-2 flex flex-wrap gap-1.5 px-5">
          {surge.signals.map((sig) => {
            const style = SURGE_BADGE[sig.level as Exclude<SurgeLevel, 'none'>];
            return (
              <span
                key={sig.type}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.bg} ${style.text} ${style.border}`}
              >
                {sig.label}
                <span className="font-normal opacity-70">{sig.detail}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* ── Current Price + Sparkline ── */}
      <div className="mt-3 flex items-end justify-between px-5">
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {fmt(stock.price)}
            <span className="ml-1 text-sm font-normal text-gray-400">원</span>
          </p>
          <p className={`text-sm font-semibold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
            {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{stock.changePercent.toFixed(1)}%
          </p>
        </div>
        <Sparkline points={series.points} trend={series.trend} width={80} height={32} />
      </div>

      <div className="mx-5 mt-4 border-t border-gray-100" />

      <div className="pt-3">
        <CardEntrySignals signals={entrySignals} loading={signalsLoading} />
      </div>

      <div className="mx-5 border-t border-gray-100" />

      {/* ── Risk Level ── */}
      <div className="mt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskBadge level={riskScore.level} />
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${attn.badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${attn.dot}`} />
              {riskScore.attentionLevel}
            </span>
          </div>
          <span className="text-xs text-gray-400">리스크 {riskScore.score}점</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${SCORE_BAR_COLOR[riskScore.level]}`}
            style={{ width: `${riskScore.score}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{riskScore.attentionReason}</p>
      </div>

      <div className="mx-5 mt-4 border-t border-gray-100" />

      {/* ── Take-profit scenario ── */}
      <div className="px-5 pt-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <span>📈</span> 익절 참고 구간
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {fmt(riskScore.estimatedTakeProfitRange.low)}원
          <span className="mx-1 text-gray-400">~</span>
          {fmt(riskScore.estimatedTakeProfitRange.high)}원
        </p>
        <p className="mt-0.5 text-xs text-gray-400">이 구간 도달 시 참고할 수 있는 단기 시나리오</p>
      </div>

      {/* ── Stop-loss scenario ── */}
      <div className="px-5 pt-3 pb-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <span>🛑</span> 손절 참고 구간
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {fmt(riskScore.estimatedStopLossLevel)}원 이하
        </p>
        <p className="mt-0.5 text-xs text-gray-400">이 가격 이탈 시 손실 제한 고려 가능한 시나리오</p>
      </div>

      <div className="mx-5 border-t border-gray-100" />

      {/* ── Risk reasons ── */}
      <div className="px-5 py-3">
        <p className="mb-1.5 text-xs font-semibold text-gray-500">⚠️ 주요 리스크 요인</p>
        <ul className="space-y-1">
          {riskScore.reasons.slice(0, 3).map((reason, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
              <span className="mt-0.5 shrink-0 text-gray-300">·</span>
              {reason}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
