import { WatchlistDashboard } from '@/features/watchlist/components/WatchlistDashboard';
import { MarketRecommendations } from '@/features/market-news/components/MarketRecommendations';
import { NewsSection } from '@/features/market-news/components/NewsSection';
import { ThemeSection } from '@/features/market-news/components/ThemeSection';
import { GlobalSignalsSection } from '@/features/global-signals/components/GlobalSignalsSection';
import { PaperTradingDashboard } from '@/features/paper-trading/components/PaperTradingDashboard';

export const metadata = {
  title: '단타코치 — 대시보드',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">단타코치</span>
            <span className="hidden text-sm text-gray-400 sm:inline">·</span>
            <span className="hidden text-sm text-gray-500 sm:inline">단기매매 리스크 분석</span>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">이 앱은 리스크 참고용입니다. 매매 추천이 아닙니다.</p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <MarketRecommendations />
        <GlobalSignalsSection />
        <ThemeSection />
        <NewsSection />
        <WatchlistDashboard />
        <PaperTradingDashboard />
      </main>
    </div>
  );
}
