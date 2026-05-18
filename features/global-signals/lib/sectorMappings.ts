export interface SectorMapping {
  id: string;
  label: string;       // Korean display name
  keywords: string[];  // lowercase English, substring-matched
  koreanTickers: string[];
}

// Order matters: when two sectors tie on keyword count, the first one wins.
// Put more-specific sectors before broader ones.
export const SECTOR_MAPPINGS: SectorMapping[] = [
  {
    id: 'ai',
    label: 'AI',
    keywords: [
      'artificial intelligence', 'chatgpt', 'openai', 'llm', 'generative ai',
      'large language model', 'machine learning',
    ],
    koreanTickers: ['005930', '000660', '042700'],
  },
  {
    id: 'semiconductor',
    label: '반도체',
    keywords: [
      'nvidia', 'tsmc', 'amd', 'broadcom', 'semiconductor', 'chip',
      'intel', 'arm', 'qualcomm', 'micron', 'applied materials', 'lam research', 'asml', 'gpu',
    ],
    koreanTickers: ['005930', '000660', '042700', '058470'],
  },
  {
    id: 'battery',
    label: 'EV/2차전지',
    keywords: [
      'tesla', 'electric vehicle', 'battery', 'lithium', 'ev ', 'byd',
      'rivian', 'lucid', 'cathode', 'anode',
    ],
    koreanTickers: ['373220', '006400', '086520', '247540', '003670'],
  },
  {
    id: 'biotech',
    label: '바이오/제약',
    keywords: [
      'fda approval', 'fda cleared', 'clinical trial', 'drug approval',
      'pharma', 'biotech', 'oncology', 'vaccine', 'antibody', 'biologic',
    ],
    koreanTickers: ['068270', '128940', '196170', '000100'],
  },
  {
    id: 'energy',
    label: '에너지',
    keywords: [
      'crude oil', 'oil price', 'opec', 'natural gas', 'renewables',
      'solar', 'hydrogen', 'energy transition',
    ],
    koreanTickers: ['034020', '336260', '015760'],
  },
  {
    id: 'fed_rates',
    label: '연준/금리',
    keywords: [
      'federal reserve', 'fed rate', 'fomc', 'rate hike', 'rate cut',
      'jerome powell', 'monetary policy', 'treasury yield', 'interest rate',
    ],
    koreanTickers: [],
  },
  {
    id: 'nasdaq',
    label: '나스닥/S&P',
    keywords: [
      'nasdaq', 's&p 500', 'sp500', 'dow jones', 'wall street',
      'market rally', 'market selloff', 'stock market crash', 'equity market',
    ],
    koreanTickers: [],
  },
];
