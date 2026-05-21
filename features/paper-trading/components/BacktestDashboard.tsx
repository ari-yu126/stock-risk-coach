'use client';

import { BacktestSection } from './BacktestSection';
import { SignalPerformanceSection } from '@/features/watchlist/components/SignalPerformanceSection';

export function BacktestDashboard() {
  return (
    <section className="space-y-10">
      {/* Real-time signal tracking (next-day evaluation) */}
      <div>
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">실시간 전략 성과</h2>
          <p className="text-sm text-gray-500">
            관심종목 진입 신호의 익일 종가 자동 평가 · 장기 백테스트와 별도 집계
          </p>
        </div>
        <SignalPerformanceSection />
      </div>

      <div className="border-t border-gray-200 pt-10">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">전략 백테스트 (장기)</h2>
          <p className="text-sm text-gray-500">
            관심종목 기준 · 최근 약 180거래일 · 일봉 시뮬레이션 · 거래량 돌파 / RSI 반등 / 눌림목
          </p>
        </div>
        <BacktestSection />
      </div>
    </section>
  );
}
