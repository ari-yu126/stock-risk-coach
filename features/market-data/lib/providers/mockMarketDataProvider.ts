import { resolveStockName } from '../resolveStockName';
import type { MarketStock, PriceSource } from '../../types';
import type { MarketDataProvider, MarketDataQuery } from './types';

const MOCK_PRICE_SOURCE: PriceSource = 'mock';

// tradingValue helper: price × volume ÷ 100,000,000 (억원)
function tv(price: number, volume: number): number {
  return Math.round((price * volume) / 100_000_000);
}

const MOCK_STOCKS: Omit<MarketStock, 'priceSource'>[] = [
  // ── 반도체 ─────────────────────────────────────────────────────────────────
  {
    ticker: '005930',
    name: '삼성전자',
    sector: '반도체',
    price: 72400,
    changePercent: 0.8,
    volume: 11_200_000,
    avgVolume: 10_800_000,   // volume ratio ≈ 1.04 — normal
    marketCapBillion: 432_000,
    tradingValue: tv(72400, 11_200_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '000660',
    name: 'SK하이닉스',
    sector: '반도체',
    price: 198500,
    changePercent: 2.1,
    volume: 3_800_000,
    avgVolume: 2_100_000,    // volume ratio ≈ 1.81 — moderate spike
    marketCapBillion: 144_000,
    tradingValue: tv(198500, 3_800_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '042700',
    name: '한미반도체',
    sector: '반도체',
    price: 92600,
    changePercent: 5.8,
    volume: 2_450_000,
    avgVolume: 680_000,      // volume ratio ≈ 3.60 — strong spike
    marketCapBillion: 7_100,
    tradingValue: tv(92600, 2_450_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '058470',
    name: '리노공업',
    sector: '반도체',
    price: 248000,
    changePercent: 0.4,
    volume: 84_000,
    avgVolume: 92_000,       // volume ratio ≈ 0.91 — below average
    marketCapBillion: 3_100,
    tradingValue: tv(248000, 84_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '007660',
    name: '이수페타시스',
    sector: '반도체',
    price: 38200,
    changePercent: 4.1,
    volume: 1_620_000,
    avgVolume: 510_000,      // volume ratio ≈ 3.18 — strong spike (AI PCB 테마)
    marketCapBillion: 1_850,
    tradingValue: tv(38200, 1_620_000),
    marketType: 'KOSPI',
  },

  // ── 2차전지 ────────────────────────────────────────────────────────────────
  {
    ticker: '086520',
    name: '에코프로',
    sector: '2차전지',
    price: 82000,
    changePercent: 7.3,
    volume: 980_000,
    avgVolume: 158_000,      // volume ratio ≈ 6.20 — extreme spike
    marketCapBillion: 420,
    tradingValue: tv(82000, 980_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '247540',
    name: '에코프로비엠',
    sector: '2차전지',
    price: 148500,
    changePercent: 6.1,
    volume: 740_000,
    avgVolume: 210_000,      // volume ratio ≈ 3.52 — strong spike
    marketCapBillion: 12_100,
    tradingValue: tv(148500, 740_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '373220',
    name: 'LG에너지솔루션',
    sector: '2차전지',
    price: 302000,
    changePercent: 1.5,
    volume: 520_000,
    avgVolume: 410_000,      // volume ratio ≈ 1.27 — normal
    marketCapBillion: 70_800,
    tradingValue: tv(302000, 520_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '006400',
    name: '삼성SDI',
    sector: '2차전지',
    price: 238000,
    changePercent: -5.1,
    volume: 310_000,
    avgVolume: 480_000,      // volume ratio ≈ 0.65 — low volume on down day
    marketCapBillion: 16_400,
    tradingValue: tv(238000, 310_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '003670',
    name: '포스코퓨처엠',
    sector: '2차전지',
    price: 276000,
    changePercent: -1.8,
    volume: 220_000,
    avgVolume: 260_000,      // volume ratio ≈ 0.85 — slightly low
    marketCapBillion: 24_000,
    tradingValue: tv(276000, 220_000),
    marketType: 'KOSPI',
  },

  // ── 바이오 ─────────────────────────────────────────────────────────────────
  {
    ticker: '068270',
    name: '셀트리온',
    sector: '바이오',
    price: 173000,
    changePercent: -3.1,
    volume: 2_400_000,
    avgVolume: 1_000_000,    // volume ratio ≈ 2.40 — elevated on down move
    marketCapBillion: 24_000,
    tradingValue: tv(173000, 2_400_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '128940',
    name: '한미약품',
    sector: '바이오',
    price: 285000,
    changePercent: 3.2,
    volume: 185_000,
    avgVolume: 95_000,       // volume ratio ≈ 1.95 — moderate spike (임상 이슈)
    marketCapBillion: 3_350,
    tradingValue: tv(285000, 185_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '196170',
    name: '알테오젠',
    sector: '바이오',
    price: 208000,
    changePercent: 8.4,
    volume: 920_000,
    avgVolume: 190_000,      // volume ratio ≈ 4.84 — large spike (기술수출)
    marketCapBillion: 11_400,
    tradingValue: tv(208000, 920_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '000100',
    name: '유한양행',
    sector: '바이오',
    price: 88500,
    changePercent: 0.6,
    volume: 340_000,
    avgVolume: 320_000,      // volume ratio ≈ 1.06 — normal
    marketCapBillion: 6_200,
    tradingValue: tv(88500, 340_000),
    marketType: 'KOSPI',
  },

  // ── 자동차 ─────────────────────────────────────────────────────────────────
  {
    ticker: '005380',
    name: '현대자동차',
    sector: '자동차',
    price: 218000,
    changePercent: 0.5,
    volume: 680_000,
    avgVolume: 760_000,      // volume ratio ≈ 0.89 — slightly low
    marketCapBillion: 46_600,
    tradingValue: tv(218000, 680_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '000270',
    name: '기아',
    sector: '자동차',
    price: 116500,
    changePercent: 1.2,
    volume: 1_050_000,
    avgVolume: 950_000,      // volume ratio ≈ 1.11 — normal
    marketCapBillion: 47_000,
    tradingValue: tv(116500, 1_050_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '012330',
    name: '현대모비스',
    sector: '자동차',
    price: 245000,
    changePercent: -0.8,
    volume: 280_000,
    avgVolume: 310_000,      // volume ratio ≈ 0.90 — normal
    marketCapBillion: 23_200,
    tradingValue: tv(245000, 280_000),
    marketType: 'KOSPI',
  },

  // ── 플랫폼 ─────────────────────────────────────────────────────────────────
  {
    ticker: '035720',
    name: '카카오',
    sector: '플랫폼',
    price: 46800,
    changePercent: -4.2,
    volume: 12_600_000,
    avgVolume: 3_600_000,    // volume ratio ≈ 3.50 — panic sell spike
    marketCapBillion: 20_800,
    tradingValue: tv(46800, 12_600_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '035420',
    name: '네이버',
    sector: '플랫폼',
    price: 188000,
    changePercent: -1.4,
    volume: 680_000,
    avgVolume: 750_000,      // volume ratio ≈ 0.91 — normal
    marketCapBillion: 30_800,
    tradingValue: tv(188000, 680_000),
    marketType: 'KOSPI',
  },

  // ── 로봇 ───────────────────────────────────────────────────────────────────
  {
    ticker: '277810',
    name: '레인보우로보틱스',
    sector: '로봇',
    price: 156000,
    changePercent: 9.2,
    volume: 1_840_000,
    avgVolume: 320_000,      // volume ratio ≈ 5.75 — theme-driven surge
    marketCapBillion: 3_050,
    tradingValue: tv(156000, 1_840_000),
    marketType: 'KOSDAQ',
  },
  {
    ticker: '454910',
    name: '두산로보틱스',
    sector: '로봇',
    price: 68400,
    changePercent: 4.8,
    volume: 2_150_000,
    avgVolume: 780_000,      // volume ratio ≈ 2.76 — moderate spike
    marketCapBillion: 4_800,
    tradingValue: tv(68400, 2_150_000),
    marketType: 'KOSPI',
  },

  // ── 조선 ───────────────────────────────────────────────────────────────────
  {
    ticker: '329180',
    name: 'HD현대중공업',
    sector: '조선',
    price: 204000,
    changePercent: 2.8,
    volume: 640_000,
    avgVolume: 380_000,      // volume ratio ≈ 1.68 — moderate (수주 뉴스)
    marketCapBillion: 16_800,
    tradingValue: tv(204000, 640_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '042660',
    name: '한화오션',
    sector: '조선',
    price: 37800,
    changePercent: 1.9,
    volume: 3_200_000,
    avgVolume: 2_100_000,    // volume ratio ≈ 1.52 — moderate
    marketCapBillion: 9_200,
    tradingValue: tv(37800, 3_200_000),
    marketType: 'KOSPI',
  },

  // ── 금융 ───────────────────────────────────────────────────────────────────
  {
    ticker: '105560',
    name: 'KB금융',
    sector: '금융',
    price: 76200,
    changePercent: -1.2,
    volume: 1_180_000,
    avgVolume: 1_050_000,    // volume ratio ≈ 1.12 — normal
    marketCapBillion: 30_500,
    tradingValue: tv(76200, 1_180_000),
    marketType: 'KOSPI',
  },
  {
    ticker: '086790',
    name: '하나금융지주',
    sector: '금융',
    price: 58400,
    changePercent: -0.7,
    volume: 820_000,
    avgVolume: 780_000,      // volume ratio ≈ 1.05 — normal
    marketCapBillion: 17_400,
    tradingValue: tv(58400, 820_000),
    marketType: 'KOSPI',
  },
];

function stubStock(ticker: string): MarketStock {
  const base = MOCK_STOCKS.find((s) => s.ticker === ticker);
  if (base) return { ...base, priceSource: MOCK_PRICE_SOURCE };

  const name = resolveStockName(ticker);
  const price = 50_000 + (parseInt(ticker.slice(-3), 10) % 500) * 100;
  return {
    ticker,
    name,
    sector: '기타',
    price,
    changePercent: 0,
    volume: 500_000,
    avgVolume: 500_000,
    marketCapBillion: 10_000,
    tradingValue: tv(price, 500_000),
    marketType: 'KOSPI',
    priceSource: MOCK_PRICE_SOURCE,
  };
}

export const mockMarketDataProvider: MarketDataProvider = {
  async fetchStocks(query: MarketDataQuery = {}): Promise<MarketStock[]> {
    if (query.tickers?.length) {
      return query.tickers.map((t) => stubStock(t));
    }

    let stocks: MarketStock[] = MOCK_STOCKS.map((s) => ({ ...s, priceSource: MOCK_PRICE_SOURCE }));

    if (query.sector) {
      stocks = stocks.filter((s) => s.sector === query.sector);
    }
    if (query.marketType) {
      stocks = stocks.filter((s) => s.marketType === query.marketType);
    }
    if (query.limit) {
      stocks = stocks.slice(0, query.limit);
    }

    return stocks;
  },
};
