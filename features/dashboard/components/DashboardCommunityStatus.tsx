'use client';

import { useEffect, useState } from 'react';
import { loadTickers, WATCHLIST_CHANGED_EVENT } from '@/features/watchlist/lib/storage';
import { useWatchlistCommunity } from '@/features/watchlist/hooks/useWatchlistCommunity';
import { CommunitySourceStatusBar } from '@/features/community-sentiment/components/CommunitySourceStatusBar';

const SHORT: Record<string, string> = {
  'market-data': '시세',
  'naver-jongto': '종토방',
  'naver-search-dc': '디시',
  'naver-search-fm': '에펨',
};

export function DashboardCommunityStatus() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = () => setTickers(loadTickers());
    sync();
    window.addEventListener(WATCHLIST_CHANGED_EVENT, sync);
    return () => window.removeEventListener(WATCHLIST_CHANGED_EVENT, sync);
  }, []);

  const { sourceStatuses, loading, dataKind } = useWatchlistCommunity(tickers);

  if (!sourceStatuses?.length && !loading) {
    return <p className="text-xs text-gray-400">관심종목 추가 후 연동 상태가 표시됩니다.</p>;
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs"
      >
        <span>
          <span className="font-medium text-gray-700">커뮤니티 연동</span>
          {dataKind === 'live' && (
            <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              LIVE
            </span>
          )}
          {loading && <span className="ml-2 text-gray-400">갱신 중…</span>}
        </span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {!open && sourceStatuses && (
        <div className="flex flex-wrap gap-1.5 border-t border-gray-100 px-3 pb-2">
          {sourceStatuses.map((s) => (
            <span
              key={s.id}
              className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600"
              title={s.detail}
            >
              {SHORT[s.id] ?? s.label} · {s.status}
            </span>
          ))}
        </div>
      )}
      {open && sourceStatuses && (
        <div className="border-t border-gray-100 px-3 py-2">
          <CommunitySourceStatusBar sources={sourceStatuses} />
        </div>
      )}
    </div>
  );
}
