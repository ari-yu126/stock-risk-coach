'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { StockSearchResult } from '@/app/api/stock-search/route';

const DEBOUNCE_MS = 300;

interface AddStockModalProps {
  open: boolean;
  onClose: () => void;
  watchedTickers: string[];
  onAdd: (ticker: string) => void;
}

type SearchState = 'idle' | 'loading' | 'done' | 'error';

export function AddStockModal({ open, onClose, watchedTickers, onAdd }: AddStockModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchedSet = new Set(watchedTickers);

  // Debounced search — all setState calls happen inside the setTimeout callback, not synchronously.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    debounceRef.current = setTimeout(async () => {
      if (trimmed.length === 0) {
        setResults([]);
        setSearchState('idle');
        return;
      }
      setSearchState('loading');
      try {
        const r = await fetch(`/api/stock-search?q=${encodeURIComponent(trimmed)}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = (await r.json()) as { results: StockSearchResult[] };
        setResults(data.results.filter((s) => !watchedSet.has(s.ticker)));
        setSearchState('done');
      } catch {
        setSearchState('error');
        setResults([]);
      }
    }, trimmed.length === 0 ? 0 : DEBOUNCE_MS);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(ticker: string) {
    onAdd(ticker);
    onClose();
    setQuery('');
    setResults([]);
    setSearchState('idle');
  }

  function handleClose() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery('');
    setResults([]);
    setSearchState('idle');
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="종목 추가">
      <div className="space-y-3">
        {/* Search input */}
        <div>
          <label htmlFor="stock-search-input" className="mb-1.5 block text-sm font-medium text-gray-700">
            종목 검색
          </label>
          <div className="relative">
            <input
              id="stock-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="종목명 또는 티커 입력 (예: 삼성전자, 005930)"
              autoComplete="off"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            {/* Loading spinner or search icon */}
            <span className="absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
              {searchState === 'loading' ? (
                <svg className="h-4 w-4 animate-spin text-gray-400" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-gray-300" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="4.5" />
                  <path d="M10.5 10.5L14 14" />
                </svg>
              )}
            </span>
          </div>
        </div>

        {/* Results */}
        {query.trim().length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200">
            {searchState === 'loading' && (
              <div role="status" aria-label="검색 중" className="space-y-2 p-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center justify-between">
                    <div className="space-y-1">
                      <div className="h-4 w-24 rounded bg-gray-100" />
                      <div className="h-3 w-16 rounded bg-gray-100" />
                    </div>
                    <div className="h-5 w-14 rounded bg-gray-100" />
                  </div>
                ))}
              </div>
            )}

            {searchState === 'done' && results.length === 0 && (
              <p className="py-6 text-center text-sm text-gray-400">검색 결과가 없어요.</p>
            )}

            {searchState === 'error' && (
              <p className="py-6 text-center text-sm text-gray-400">
                검색 중 오류가 발생했어요. 다시 시도해주세요.
              </p>
            )}

            {searchState === 'done' && results.length > 0 && (
              <ul>
                {results.map((r) => (
                  <li key={r.ticker}>
                    <button
                      onClick={() => handleSelect(r.ticker)}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-gray-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.ticker}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.marketType === 'KOSDAQ'
                          ? 'bg-purple-50 text-purple-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}>
                        {r.marketType}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {query.trim().length === 0 && (
          <p className="text-center text-xs text-gray-400">종목명이나 티커를 입력하면 검색돼요.</p>
        )}

        <div className="pt-1">
          <Button variant="secondary" className="w-full" onClick={handleClose}>
            취소
          </Button>
        </div>
      </div>
    </Modal>
  );
}
