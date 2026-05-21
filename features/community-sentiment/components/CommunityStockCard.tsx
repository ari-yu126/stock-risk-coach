'use client';

import type { CommunityStockItem } from '../types';

interface CommunityStockCardProps {
  item: CommunityStockItem;
  onClick: () => void;
}

const RISK_CLS = {
  LOW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  HIGH: 'border-red-200 bg-red-50 text-red-700',
};

const DIR_ICON = {
  up: { icon: '▲', cls: 'text-red-500' },
  down: { icon: '▼', cls: 'text-blue-500' },
  flat: { icon: '─', cls: 'text-gray-400' },
};

export function CommunityStockCard({ item, onClick }: CommunityStockCardProps) {
  const dir = DIR_ICON[item.changeDirection];
  const posPct = Math.round(item.positiveRatio * 100);
  const negPct = Math.round(item.negativeRatio * 100);
  const neuPct = Math.round(item.neutralRatio * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-shadow hover:border-violet-200 hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{item.name}</p>
          <p className="text-xs text-gray-400">{item.ticker} · {item.sector}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-lg font-bold tabular-nums ${dir.cls}`} aria-hidden="true">
            {dir.icon}
          </span>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700">
            {item.communityScore}
          </span>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {item.fomoHigh && (
          <span className="rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
            FOMO HIGH
          </span>
        )}
        {item.overheatWarning && (
          <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
            과열 경고
          </span>
        )}
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${RISK_CLS[item.riskLevel]}`}>
          {item.riskLevel}
        </span>
      </div>

      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-600">{item.aiSummary}</p>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <span className="text-gray-400">언급 증가</span>
        <span className="text-right font-semibold tabular-nums text-gray-800">
          {item.mentionGrowthPercent >= 0 ? '+' : ''}{item.mentionGrowthPercent}%
        </span>
        <span className="text-gray-400">댓글 성향</span>
        <span className="text-right tabular-nums text-[11px] leading-snug">
          <span className="text-red-500">긍정 {posPct}%</span>
          <span className="text-gray-300"> · </span>
          <span className="text-blue-500">부정 {negPct}%</span>
          {neuPct > 0 && (
            <>
              <span className="text-gray-300"> · </span>
              <span className="text-gray-500">중립 {neuPct}%</span>
            </>
          )}
        </span>
        <span className="text-gray-400">거래량 증가</span>
        <span className="text-right font-semibold tabular-nums text-gray-800">
          {item.volumeGrowthPercent >= 0 ? '+' : ''}{item.volumeGrowthPercent}%
        </span>
        <span className="text-gray-400">1시간 변화</span>
        <span
          className={`text-right font-semibold tabular-nums ${
            item.hourOverHourChange >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {item.hourOverHourChange >= 0 ? '+' : ''}{item.hourOverHourChange}
        </span>
      </div>

      {item.trendKeywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {item.trendKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
