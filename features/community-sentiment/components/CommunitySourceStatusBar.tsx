'use client';

import type { CommunitySourceStatus, SourceDisplayStatus } from '../lib/sourceStatus';

const STATUS_STYLE: Record<SourceDisplayStatus, string> = {
  LIVE: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  OK: 'border-blue-200 bg-blue-50 text-blue-800',
  RATE_LIMITED: 'border-orange-300 bg-orange-50 text-orange-800',
  UNAVAILABLE: 'border-gray-300 bg-gray-100 text-gray-600',
  SKIPPED: 'border-gray-200 bg-gray-50 text-gray-500',
  DEGRADED: 'border-amber-300 bg-amber-50 text-amber-800',
  WARNING: 'border-yellow-300 bg-yellow-50 text-yellow-800',
  ERROR: 'border-red-300 bg-red-50 text-red-800',
};

const STATUS_LABEL: Record<SourceDisplayStatus, string> = {
  LIVE: 'LIVE',
  OK: 'OK',
  RATE_LIMITED: 'RATE LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  SKIPPED: 'SKIPPED',
  DEGRADED: 'DEGRADED',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
};

interface CommunitySourceStatusBarProps {
  sources: CommunitySourceStatus[];
}

export function CommunitySourceStatusBar({ sources }: CommunitySourceStatusBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s) => (
        <div
          key={s.id}
          className={`rounded-lg border px-3 py-2 text-xs ${STATUS_STYLE[s.status]}`}
          title={s.detail}
        >
          <span className="font-semibold">{s.label}</span>
          <span className="mx-1.5 font-mono text-[10px] opacity-80">·</span>
          <span className="font-mono font-bold">{STATUS_LABEL[s.status]}</span>
          {s.detail && (
            <p className="mt-0.5 max-w-[200px] truncate font-mono text-[10px] opacity-75">
              {s.detail}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
