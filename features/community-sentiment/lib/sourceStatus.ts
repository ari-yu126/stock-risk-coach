import type { CommunityCollectCode } from './collectCodes';
import type { CommunityFetchLog, DebugLogSource } from './collectDebug';
import {
  getSearchCooldownUntil,
  hasCachedSearchPosts,
  isSearchSourceInCooldown,
  type SearchCacheSource,
} from './searchSourceCache';

export type SourceDisplayStatus =
  | 'LIVE'
  | 'OK'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'SKIPPED'
  | 'DEGRADED'
  | 'WARNING'
  | 'ERROR';

export interface CommunitySourceStatus {
  id: 'market-data' | 'naver-jongto' | 'naver-search-dc' | 'naver-search-fm';
  label: string;
  status: SourceDisplayStatus;
  detail?: string;
  httpStatus?: number;
  cooldownUntil?: string | null;
}

const SOURCE_LABELS: Record<CommunitySourceStatus['id'], string> = {
  'market-data': '시세',
  'naver-jongto': '종토방',
  'naver-search-dc': '디시 검색',
  'naver-search-fm': '에펨 검색',
};

function isSuccessCode(code: CommunityCollectCode): boolean {
  return code === 'OK' || code === 'MARKET_DATA_LIVE_OK';
}

function isWarningCode(code: CommunityCollectCode): boolean {
  return (
    code === 'SEARCH_API_429' ||
    code === 'SOURCE_COOLDOWN_SKIP' ||
    code === 'SEARCH_API_EMPTY_RESPONSE' ||
    code === 'NAVER_DISCUSS_FILTERED_EMPTY' ||
    code === 'MARKET_DATA_FALLBACK_MOCK' ||
    code === 'TICKER_NO_POSTS'
  );
}

function logsForSource(logs: CommunityFetchLog[], source: DebugLogSource): CommunityFetchLog[] {
  return logs.filter((l) => l.source === source);
}

function aggregateDiscussStatus(logs: CommunityFetchLog[]): CommunitySourceStatus {
  const discussLogs = logs.filter((l) => l.source === 'naver-jongto');
  const okCount = discussLogs.filter((l) => l.code === 'OK').length;
  const total = discussLogs.length;

  if (okCount > 0) {
    const posts = discussLogs.reduce((s, l) => s + (l.responseCount ?? 0), 0);
    return {
      id: 'naver-jongto',
      label: SOURCE_LABELS['naver-jongto'],
      status: 'LIVE',
      detail: `${okCount}/${total}종목 수집 · ${posts}건`,
    };
  }

  if (total === 0) {
    return {
      id: 'naver-jongto',
      label: SOURCE_LABELS['naver-jongto'],
      status: 'ERROR',
      detail: '수집 로그 없음',
    };
  }

  const last = discussLogs[discussLogs.length - 1];
  return {
    id: 'naver-jongto',
    label: SOURCE_LABELS['naver-jongto'],
    status: 'ERROR',
    detail: last?.code ?? 'FAILED',
    httpStatus: last?.httpStatus,
  };
}

function aggregateSearchStatus(
  cacheSource: SearchCacheSource,
  postSource: 'dc-stock' | 'fmkorea-stock',
  logs: CommunityFetchLog[],
): CommunitySourceStatus {
  const id = cacheSource === 'naver-search-dc' ? 'naver-search-dc' : 'naver-search-fm';
  const sourceLogs = logsForSource(logs, cacheSource);

  if (sourceLogs.some((l) => l.code === 'SEARCH_API_SKIPPED')) {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: 'SKIPPED',
      detail: 'API 키 없음',
    };
  }

  if (isSearchSourceInCooldown(cacheSource)) {
    const hasCache = hasCachedSearchPosts(cacheSource);
    return {
      id,
      label: SOURCE_LABELS[id],
      status: 'RATE_LIMITED',
      detail: hasCache ? '캐시 사용 중' : 'source unavailable',
      cooldownUntil: getSearchCooldownUntil(cacheSource),
    };
  }

  const okCount = sourceLogs.filter((l) => l.code === 'OK').length;
  const rateLimited = sourceLogs.some((l) => l.code === 'SEARCH_API_429');
  const hasCache = hasCachedSearchPosts(cacheSource);

  if (okCount > 0) {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: rateLimited ? 'WARNING' : 'OK',
      detail: rateLimited ? '일부 429 · 캐시 병행' : `${okCount}종목 수집`,
    };
  }

  if (rateLimited || sourceLogs.some((l) => l.code === 'SOURCE_COOLDOWN_SKIP')) {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: hasCache ? 'RATE_LIMITED' : 'UNAVAILABLE',
      detail: hasCache ? '429 · 캐시만 사용' : '429 · 캐시 없음',
      cooldownUntil: getSearchCooldownUntil(cacheSource),
    };
  }

  if (sourceLogs.length === 0) {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: 'SKIPPED',
      detail: '미호출',
    };
  }

  const last = sourceLogs[sourceLogs.length - 1];
  if (isWarningCode(last.code)) {
    return {
      id,
      label: SOURCE_LABELS[id],
      status: 'WARNING',
      detail: last.code,
      httpStatus: last.httpStatus,
    };
  }

  return {
    id,
    label: SOURCE_LABELS[id],
    status: 'ERROR',
    detail: last.code,
    httpStatus: last.httpStatus,
  };
}

function aggregateMarketStatus(logs: CommunityFetchLog[]): CommunitySourceStatus {
  const marketLogs = logs.filter((l) => l.source === 'market-data');
  const live = marketLogs.find((l) => l.code === 'MARKET_DATA_LIVE_OK');
  if (live) {
    return {
      id: 'market-data',
      label: SOURCE_LABELS['market-data'],
      status: 'LIVE',
      detail: live.message,
      httpStatus: live.httpStatus,
    };
  }
  const mock = marketLogs.find((l) => l.code === 'MARKET_DATA_FALLBACK_MOCK');
  if (mock) {
    return {
      id: 'market-data',
      label: SOURCE_LABELS['market-data'],
      status: 'DEGRADED',
      detail: 'mock 시세 fallback',
    };
  }
  const fail = marketLogs[marketLogs.length - 1];
  return {
    id: 'market-data',
    label: SOURCE_LABELS['market-data'],
    status: 'ERROR',
    detail: fail?.message ?? '시세 실패',
  };
}

export function buildSourceStatuses(logs: CommunityFetchLog[]): CommunitySourceStatus[] {
  return [
    aggregateMarketStatus(logs),
    aggregateDiscussStatus(logs),
    aggregateSearchStatus('naver-search-dc', 'dc-stock', logs),
    aggregateSearchStatus('naver-search-fm', 'fmkorea-stock', logs),
  ];
}

export function collectWarningCodes(logs: CommunityFetchLog[]): CommunityCollectCode[] {
  const warnings = new Set<CommunityCollectCode>();
  for (const log of logs) {
    if (isWarningCode(log.code) || (log.code !== 'OK' && !isSuccessCode(log.code) && log.source !== 'collector')) {
      if (log.source === 'naver-search-dc' || log.source === 'naver-search-fm') {
        warnings.add(log.code);
      }
    }
  }
  return [...warnings];
}

/** LIVE when market + jongto critical path succeeded */
export function evaluateCollectOutcome(params: {
  marketTickerCount: number;
  discussPostCount: number;
  itemCount: number;
  logs: CommunityFetchLog[];
}): { canLive: boolean; fallbackReason?: string } {
  const discussOk =
    params.discussPostCount > 0 ||
    params.logs.some((l) => l.source === 'naver-jongto' && l.code === 'OK');

  const marketOk = params.marketTickerCount > 0;

  if (marketOk && discussOk) {
    return { canLive: true };
  }

  if (!marketOk && !discussOk) {
    return { canLive: false, fallbackReason: 'MARKET_AND_DISCUSS_FAILED' };
  }
  if (!discussOk) {
    return { canLive: false, fallbackReason: 'DISCUSS_FAILED' };
  }
  return { canLive: false, fallbackReason: 'MARKET_FAILED' };
}
