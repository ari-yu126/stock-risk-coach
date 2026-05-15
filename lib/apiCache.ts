/**
 * In-memory cache with TTL and concurrent-request deduplication.
 *
 * One singleton per Node.js process — survives across HTTP requests
 * but resets on process restart or hot-reload.
 *
 * NOT suitable for horizontally scaled deployments; use Redis for those.
 */

interface CacheEntry<T> {
  value: T;
  cachedAt: number; // Date.now()
}

export interface CacheMeta {
  hit: boolean;
  ageMs: number | null; // null on a fresh (uncached) response
}

class ApiCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Fetch a value from cache or call `fetcher` if stale/missing.
   * Concurrent calls with the same key share a single in-flight promise.
   */
  async fetch<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<{ data: T; meta: CacheMeta }> {
    const now = Date.now();
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (entry) {
      const ageMs = now - entry.cachedAt;
      if (ageMs < ttlMs) {
        return { data: entry.value, meta: { hit: true, ageMs } };
      }
    }

    // Reuse an in-flight request if one already started for this key
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      const data = await existing;
      const fresh = this.store.get(key) as CacheEntry<T> | undefined;
      return { data, meta: { hit: false, ageMs: fresh ? Date.now() - fresh.cachedAt : 0 } };
    }

    // Start a new request and register it as in-flight
    const promise = fetcher()
      .then((data) => {
        this.store.set(key, { value: data, cachedAt: Date.now() });
        this.inFlight.delete(key);
        return data;
      })
      .catch((err: unknown) => {
        this.inFlight.delete(key);
        throw err;
      });

    this.inFlight.set(key, promise as Promise<unknown>);
    const data = await promise;
    return { data, meta: { hit: false, ageMs: 0 } };
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  /** Visible for diagnostics/testing only. */
  size(): number {
    return this.store.size;
  }
}

// Module-level singleton — shared across all route handler invocations in the same process.
export const apiCache = new ApiCache();
