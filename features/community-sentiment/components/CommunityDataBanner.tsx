'use client';

import type { CommunitySentimentResponse } from '../types';
import { COLLECT_CODE_LABEL, type CommunityCollectCode } from '../lib/collectCodes';

interface CommunityDataBannerProps {
  data: CommunitySentimentResponse;
}

export function CommunityDataBanner({ data }: CommunityDataBannerProps) {
  const isMock = data.dataKind === 'mock' || data.providerType === 'mock';
  const fallbackCode = data.debug?.fallbackCode;
  const hasWarnings = (data.debug?.warnings?.length ?? 0) > 0;

  if (isMock) {
    return (
      <div
        role="status"
        className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3"
      >
        <p className="text-sm font-bold text-amber-900">⚠️ 샘플 데이터 (Mock) — 전체 연동 실패</p>
        <p className="mt-1 text-xs text-amber-800">
          시세·종토방 등 핵심 source가 모두 실패해 데모용 가짜 데이터를 표시합니다.
        </p>
        {fallbackCode && (
          <p className="mt-2 font-mono text-xs text-red-800">
            fallback: {fallbackCode}
            {data.debug?.fallbackMessage ? ` — ${data.debug.fallbackMessage}` : ''}
            {fallbackCode in COLLECT_CODE_LABEL && (
              <span className="ml-1 font-sans text-amber-900">
                ({COLLECT_CODE_LABEL[fallbackCode as CommunityCollectCode]})
              </span>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`rounded-xl border-2 px-4 py-3 ${
        hasWarnings
          ? 'border-yellow-300 bg-yellow-50/90'
          : 'border-emerald-200 bg-emerald-50/80'
      }`}
    >
      <p className={`text-sm font-bold ${hasWarnings ? 'text-yellow-900' : 'text-emerald-900'}`}>
        {hasWarnings ? '✓ 실시간 데이터 (일부 source 경고)' : '✓ 실시간 데이터'}
      </p>
      <p className={`mt-1 text-xs ${hasWarnings ? 'text-yellow-800' : 'text-emerald-800'}`}>
        종목 시세 + 종토방 정상 수집 · 검색 API 오류는 보조 source만 영향
        {data.debug && (
          <span className="ml-1 font-mono">
            · discuss {data.debug.summary.discussPosts} · {data.debug.fetchDurationMs}ms
            {data.cacheHit ? ' · cache HIT' : ' · cache MISS'}
          </span>
        )}
      </p>
      {hasWarnings && data.debug?.warnings && (
        <p className="mt-1 font-mono text-[10px] text-yellow-700">
          warnings: {data.debug.warnings.join(', ')}
        </p>
      )}
    </div>
  );
}
