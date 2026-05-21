import type { CommunityCollectCode } from './collectCodes';
import type { CommunitySourceStatus } from './sourceStatus';

export type DebugLogSource =
  | 'naver-jongto'
  | 'dc-stock'
  | 'fmkorea-stock'
  | 'market-data'
  | 'collector'
  | 'naver-search-dc'
  | 'naver-search-fm';

export interface CommunityFetchLog {
  source: DebugLogSource;
  code: CommunityCollectCode;
  message: string;
  ticker?: string;
  httpStatus?: number;
  responseCount?: number;
  durationMs: number;
  at: string;
}

export interface CommunityCollectSummary {
  tickersRequested: number;
  tickersWithData: number;
  discussPosts: number;
  searchDcPosts: number;
  searchFmPosts: number;
  totalPosts: number;
}

export interface CommunityCollectDebug {
  dataKind: 'live' | 'mock';
  fallbackCode?: CommunityCollectCode;
  fallbackMessage?: string;
  fetchStartedAt: string;
  fetchDurationMs: number;
  cacheHit?: boolean;
  cacheAgeMs?: number | null;
  logs: CommunityFetchLog[];
  summary: CommunityCollectSummary;
  sourceStatuses?: CommunitySourceStatus[];
  warnings?: CommunityCollectCode[];
}

export function createFetchLog(params: {
  source: DebugLogSource;
  code: CommunityCollectCode;
  message: string;
  ticker?: string;
  httpStatus?: number;
  responseCount?: number;
  durationMs: number;
}): CommunityFetchLog {
  const entry: CommunityFetchLog = {
    source: params.source,
    code: params.code,
    message: params.message,
    durationMs: params.durationMs,
    at: new Date().toISOString(),
  };
  if (params.ticker) entry.ticker = params.ticker;
  if (params.httpStatus != null) entry.httpStatus = params.httpStatus;
  if (params.responseCount != null) entry.responseCount = params.responseCount;

  const prefix = `[community][${entry.code}]${entry.ticker ? ` ${entry.ticker}` : ''}`;
  const detail = entry.httpStatus != null ? ` HTTP ${entry.httpStatus}` : '';
  const count = entry.responseCount != null ? ` count=${entry.responseCount}` : '';
  const line = `${prefix}${detail} ${entry.message}${count} (${entry.durationMs}ms)`;
  const level = logLevel(params.code);
  if (level === 'info') console.info(line);
  else if (level === 'warn') console.warn(line);
  else console.error(line);

  return entry;
}

export function searchHttpCode(status: number): CommunityCollectCode {
  if (status === 401) return 'SEARCH_API_401';
  if (status === 403) return 'SEARCH_API_403';
  if (status === 429) return 'SEARCH_API_429';
  return 'SEARCH_API_HTTP_ERROR';
}

function logLevel(code: CommunityCollectCode): 'info' | 'warn' | 'error' {
  if (code === 'OK' || code === 'MARKET_DATA_LIVE_OK') return 'info';
  if (
    code === 'SEARCH_API_429' ||
    code === 'SOURCE_COOLDOWN_SKIP' ||
    code === 'SEARCH_API_EMPTY_RESPONSE' ||
    code === 'MARKET_DATA_FALLBACK_MOCK' ||
    code === 'NAVER_DISCUSS_FILTERED_EMPTY' ||
    code === 'SOURCE_UNAVAILABLE'
  ) {
    return 'warn';
  }
  return 'error';
}

export function discussHttpCode(status: number): CommunityCollectCode {
  return 'NAVER_DISCUSS_HTTP_ERROR';
}
