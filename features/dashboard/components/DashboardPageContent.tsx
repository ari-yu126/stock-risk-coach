'use client';

import { DashboardSection } from './DashboardSection';
import { CommunitySentimentSection } from '@/features/community-sentiment/components/CommunitySentimentSection';
import { MarketRecommendations } from '@/features/market-news/components/MarketRecommendations';
import { NewsSection } from '@/features/market-news/components/NewsSection';
import { WatchlistDashboard } from '@/features/watchlist/components/WatchlistDashboard';
import { BacktestSection } from '@/features/paper-trading/components/BacktestSection';
import { SignalPerformanceSection } from '@/features/watchlist/components/SignalPerformanceSection';

/** Dashboard: briefing → news → focus → community → watchlist → backtest → live performance */
export function DashboardPageContent() {
  return (
    <div className="space-y-8">
      <DashboardSection id="market-briefing" title="오늘 시장 브리핑">
        <MarketRecommendations show={['briefing']} />
      </DashboardSection>

      <DashboardSection id="market-news" title="오늘 뉴스">
        <NewsSection compact maxItems={5} />
      </DashboardSection>

      <DashboardSection id="today-focus" title="오늘 주목 종목" hideTitle>
        <MarketRecommendations show={['focus']} defaultCompact embedded />
      </DashboardSection>

      <DashboardSection id="community-sentiment" title="커뮤니티 주목 종목" hideTitle>
        <CommunitySentimentSection embedded />
      </DashboardSection>

      <DashboardSection id="watchlist-analysis" title="내 관심종목 분석" hideTitle>
        <WatchlistDashboard embedded />
      </DashboardSection>

      <DashboardSection id="strategy-backtest" title="전략 백테스트">
        <BacktestSection />
      </DashboardSection>

      <DashboardSection id="live-performance" title="실시간 전략 성과">
        <SignalPerformanceSection />
      </DashboardSection>
    </div>
  );
}
