'use client';

import { useEffect, useState, type ReactNode } from 'react';

const DEFAULT_LIMIT = 3;

interface ShowMoreListProps<T> {
  items: T[];
  limit?: number;
  /** When this changes (e.g. filter pill), collapse back to the initial slice. */
  resetKey?: string | number;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  moreLabel?: (hiddenCount: number) => string;
}

export function ShowMoreList<T>({
  items,
  limit = DEFAULT_LIMIT,
  resetKey,
  renderItem,
  getItemKey,
  moreLabel,
}: ShowMoreListProps<T>) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [resetKey]);

  const hasMore = items.length > limit;
  const visible = expanded ? items : items.slice(0, limit);
  const hiddenCount = items.length - limit;

  return (
    <>
      {visible.map((item, index) => (
        <div key={getItemKey(item, index)}>{renderItem(item, index)}</div>
      ))}
      {hasMore && (
        <div className="border-t border-gray-100 py-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="w-full rounded-lg py-2 text-center text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
          >
            {expanded
              ? '접기'
              : (moreLabel?.(hiddenCount) ?? `더보기 (${hiddenCount}건)`)}
          </button>
        </div>
      )}
    </>
  );
}
