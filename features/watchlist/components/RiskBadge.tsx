import { RiskLevel } from '../types';

interface RiskBadgeProps {
  level: RiskLevel;
}

const STYLES: Record<RiskLevel, string> = {
  '낮음': 'bg-emerald-100 text-emerald-700',
  '보통': 'bg-yellow-100 text-yellow-700',
  '높음': 'bg-orange-100 text-orange-700',
  '위험': 'bg-red-100 text-red-700',
};

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[level]}`}>
      {level}
    </span>
  );
}
