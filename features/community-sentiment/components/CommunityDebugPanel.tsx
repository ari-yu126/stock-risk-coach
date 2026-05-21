'use client';

import type { CommunityCollectDebug } from '../lib/collectDebug';
import { COLLECT_CODE_LABEL, type CommunityCollectCode } from '../lib/collectCodes';

const IS_DEV = process.env.NODE_ENV === 'development';

interface CommunityDebugPanelProps {
  debug: CommunityCollectDebug | undefined;
}

function codeColor(code: CommunityCollectCode): string {
  if (code === 'OK') return 'text-emerald-700';
  if (code.startsWith('SEARCH_API_401') || code.startsWith('FALLBACK')) return 'text-red-700';
  if (code.includes('EMPTY') || code.includes('SKIPPED') || code.includes('NO_POSTS')) return 'text-amber-700';
  return 'text-orange-700';
}

export function CommunityDebugPanel({ debug }: CommunityDebugPanelProps) {
  if (!debug) return null;

  const errorLogs = debug.logs.filter((l) => l.code !== 'OK');

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
      <p className="font-semibold text-slate-800">수집 디버그 {IS_DEV ? '(개발 모드)' : ''}</p>

      <dl className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-slate-500">dataKind</dt>
          <dd className="font-mono font-medium">{debug.dataKind}</dd>
        </div>
        <div>
          <dt className="text-slate-500">fetch time</dt>
          <dd className="font-mono">{debug.fetchDurationMs}ms</dd>
        </div>
        <div>
          <dt className="text-slate-500">cache</dt>
          <dd className="font-mono">{debug.cacheHit ? `HIT ${debug.cacheAgeMs ?? 0}ms` : 'MISS'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">posts / tickers</dt>
          <dd className="font-mono">
            {debug.summary.totalPosts} / {debug.summary.tickersWithData}·
            {debug.summary.tickersRequested}
          </dd>
        </div>
      </dl>

      {debug.fallbackCode && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 font-mono text-red-800">
          FALLBACK: {debug.fallbackCode} — {debug.fallbackMessage}
        </p>
      )}

      <p className="mt-2 text-slate-600">
        종토방 {debug.summary.discussPosts} · 디시검색 {debug.summary.searchDcPosts} · 에펨검색{' '}
        {debug.summary.searchFmPosts}
      </p>

      {IS_DEV && (
        <div className="mt-3 max-h-64 overflow-auto rounded border border-slate-200 bg-white">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="px-2 py-1">source</th>
                <th className="px-2 py-1">code</th>
                <th className="px-2 py-1">HTTP</th>
                <th className="px-2 py-1">count</th>
                <th className="px-2 py-1">ms</th>
                <th className="px-2 py-1">ticker</th>
              </tr>
            </thead>
            <tbody>
              {(errorLogs.length > 0 ? errorLogs : debug.logs.slice(-30)).map((log, i) => (
                <tr key={`${log.at}-${i}`} className="border-t border-slate-100">
                  <td className="px-2 py-1 font-mono">{log.source}</td>
                  <td className={`px-2 py-1 font-mono ${codeColor(log.code)}`}>{log.code}</td>
                  <td className="px-2 py-1 font-mono">{log.httpStatus ?? '—'}</td>
                  <td className="px-2 py-1 font-mono">{log.responseCount ?? '—'}</td>
                  <td className="px-2 py-1 font-mono">{log.durationMs}</td>
                  <td className="px-2 py-1 font-mono">{log.ticker ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 px-2 py-1 text-slate-400">
            {errorLogs.length > 0
              ? `비정상 로그 ${errorLogs.length}건 (개발 모드: 오류 위주 표시)`
              : `최근 로그 ${Math.min(30, debug.logs.length)}건`}
          </p>
        </div>
      )}

      {!IS_DEV && errorLogs.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[10px] text-slate-600">
          {errorLogs.slice(0, 5).map((log, i) => (
            <li key={i} className="font-mono">
              {log.code}: {COLLECT_CODE_LABEL[log.code]} {log.ticker ? `(${log.ticker})` : ''}
            </li>
          ))}
          {errorLogs.length > 5 && (
            <li className="text-slate-400">…외 {errorLogs.length - 5}건 (개발 모드에서 전체 확인)</li>
          )}
        </ul>
      )}
    </div>
  );
}
