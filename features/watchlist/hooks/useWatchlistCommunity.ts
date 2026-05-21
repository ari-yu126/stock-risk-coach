'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunitySentimentResponse, CommunityStockItem } from '@/features/community-sentiment/types';
import type { CommunitySourceStatus } from '@/features/community-sentiment/lib/sourceStatus';

const TTL_MS = 15 * 60_000;
const cache = new Map<string, { data: CommunitySentimentResponse; at: number }>();

export function useWatchlistCommunity(tickers: string[]) {
  const [byTicker, setByTicker] = useState<Map<string, CommunityStockItem>>(new Map());
  const [loading, setLoading] = useState(false);
  const [sourceStatuses, setSourceStatuses] = useState<CommunitySourceStatus[] | null>(null);
  const [dataKind, setDataKind] = useState<'live' | 'mock' | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const key = [...tickers].sort().join(',');

  const fetchData = useCallback(async () => {
    if (tickers.length === 0) {
      setByTicker(new Map());
      setSourceStatuses(null);
      return;
    }

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      apply(hit.data, tickers);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);

    try {
      const r = await fetch('/api/community-sentiment', { signal: ac.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as CommunitySentimentResponse;
      cache.set(key, { data, at: Date.now() });
      apply(data, tickers);
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        /* keep last data */
      }
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }

    function apply(data: CommunitySentimentResponse, wanted: string[]) {
      const set = new Set(wanted);
      const map = new Map<string, CommunityStockItem>();
      for (const item of data.items) {
        if (set.has(item.ticker)) map.set(item.ticker, item);
      }
      setByTicker(map);
      setSourceStatuses(data.debug?.sourceStatuses ?? null);
      setDataKind(data.dataKind);
    }
  }, [tickers, key]);

  useEffect(() => {
    void fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  return { byTicker, loading, sourceStatuses, dataKind, refresh: fetchData };
}
