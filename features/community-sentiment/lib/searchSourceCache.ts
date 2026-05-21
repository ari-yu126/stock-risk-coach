import type { CommunityPost } from '../types';

export type SearchCacheSource = 'naver-search-dc' | 'naver-search-fm';

export const SEARCH_COOLDOWN_MS = 10 * 60 * 1000;

interface SourceCacheEntry {
  /** All posts from last successful fetches, keyed by ticker */
  postsByTicker: Map<string, CommunityPost[]>;
  lastSuccessAt: number;
  cooldownUntil: number;
}

const store = new Map<SearchCacheSource, SourceCacheEntry>();

function getEntry(source: SearchCacheSource): SourceCacheEntry {
  let entry = store.get(source);
  if (!entry) {
    entry = { postsByTicker: new Map(), lastSuccessAt: 0, cooldownUntil: 0 };
    store.set(source, entry);
  }
  return entry;
}

export function isSearchSourceInCooldown(source: SearchCacheSource): boolean {
  const entry = store.get(source);
  return entry != null && Date.now() < entry.cooldownUntil;
}

export function getSearchCooldownUntil(source: SearchCacheSource): string | null {
  const entry = store.get(source);
  if (!entry || entry.cooldownUntil <= Date.now()) return null;
  return new Date(entry.cooldownUntil).toISOString();
}

export function getCachedSearchPostsForTicker(
  source: SearchCacheSource,
  ticker: string,
): CommunityPost[] {
  const entry = store.get(source);
  if (!entry) return [];
  return entry.postsByTicker.get(ticker) ?? [];
}

export function hasCachedSearchPosts(source: SearchCacheSource): boolean {
  const entry = store.get(source);
  if (!entry) return false;
  return entry.postsByTicker.size > 0;
}

/** Persist successful fetch for ticker and refresh global list for this source. */
export function cacheSearchPostsForTicker(
  source: SearchCacheSource,
  ticker: string,
  posts: CommunityPost[],
): void {
  const entry = getEntry(source);
  entry.postsByTicker.set(ticker, posts);
  entry.lastSuccessAt = Date.now();
}

/** On HTTP 429: block further API calls for 10 minutes. */
export function applySearchRateLimitCooldown(source: SearchCacheSource): void {
  const entry = getEntry(source);
  entry.cooldownUntil = Date.now() + SEARCH_COOLDOWN_MS;
}

/** Visible for diagnostics */
export function getSearchCacheSnapshot(): Record<
  SearchCacheSource,
  { tickers: number; inCooldown: boolean; cooldownUntil: string | null }
> {
  const out = {} as Record<
    SearchCacheSource,
    { tickers: number; inCooldown: boolean; cooldownUntil: string | null }
  >;
  for (const source of ['naver-search-dc', 'naver-search-fm'] as const) {
    const entry = store.get(source);
    out[source] = {
      tickers: entry?.postsByTicker.size ?? 0,
      inCooldown: isSearchSourceInCooldown(source),
      cooldownUntil: getSearchCooldownUntil(source),
    };
  }
  return out;
}
