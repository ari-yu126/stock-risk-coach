'use client';

export function SectionLoadingBar({
  active,
  className = '',
}: {
  active: boolean;
  className?: string;
}) {
  if (!active) return null;

  return (
    <div
      className={`mb-3 h-1 overflow-hidden rounded-full bg-gray-200 ${className}`}
      role="progressbar"
      aria-busy="true"
      aria-label="데이터 불러오는 중"
    >
      <div className="section-loading-bar h-full rounded-full bg-blue-500" />
    </div>
  );
}
