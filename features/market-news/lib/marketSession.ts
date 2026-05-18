export type MarketSession = 'premarket' | 'intraday' | 'after-market';

export interface SessionInfo {
  session: MarketSession;
  label: string;
  focusMessage: string;
  icon: string;
}

const MARKET_OPEN_MINUTE  = 9 * 60;        // 09:00 KST
const MARKET_CLOSE_MINUTE = 15 * 60 + 30;  // 15:30 KST

export function getMarketSession(now: Date = new Date()): SessionInfo {
  const kstHours   = (now.getUTCHours() + 9) % 24;
  const kstMinutes = now.getUTCMinutes();
  const minuteOfDay = kstHours * 60 + kstMinutes;

  if (minuteOfDay < MARKET_OPEN_MINUTE) {
    return {
      session: 'premarket',
      label: '장 전',
      focusMessage: '전일 강세 테마와 예상 갭 무빙 종목을 확인하세요',
      icon: '🌅',
    };
  }
  if (minuteOfDay < MARKET_CLOSE_MINUTE) {
    return {
      session: 'intraday',
      label: '장중',
      focusMessage: '거래량 급증 · 모멘텀 신호에 집중하세요',
      icon: '📊',
    };
  }
  return {
    session: 'after-market',
    label: '장 후',
    focusMessage: '오늘 가장 강했던 테마와 내일 주목할 후보를 확인하세요',
    icon: '🌙',
  };
}
