'use client';

import type { CommunityStockItem } from '../types';
import { MiniTrendChart } from './MiniTrendChart';

interface CommunityDetailModalProps {
  item: CommunityStockItem;
  onClose: () => void;
}

const RISK_CLS = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-red-50 text-red-700 border-red-200',
};

export function CommunityDetailModal({ item, onClose }: CommunityDetailModalProps) {
  const mentions = item.hourly.map((h) => h.mentionCount);
  const sentiments = item.hourly.map((h) => h.sentimentScore);
  const volumes = item.hourly.map((h) => h.volumeRatio);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 id="community-modal-title" className="text-lg font-semibold text-gray-900">
              {item.name}
              <span className="ml-2 text-sm font-normal text-gray-400">{item.ticker}</span>
            </h3>
            <p className="mt-1 text-sm text-gray-600">{item.aiSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${RISK_CLS[item.riskLevel]}`}>
            위험도 {item.riskLevel}
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
            Community Score {item.communityScore}
          </span>
        </div>

        <div className="space-y-4">
          <MiniTrendChart values={mentions} label="최근 24시간 언급량" color="#7c3aed" />
          <MiniTrendChart values={sentiments} label="감정 점수 변화" color="#059669" />
          <MiniTrendChart values={volumes} label="거래량 비율 (평균=1)" color="#d97706" />
        </div>

        <p className="mt-4 text-[11px] text-gray-400">
          1시간 단위 스냅샷 · MVP mock 데이터
        </p>
      </div>
    </div>
  );
}
