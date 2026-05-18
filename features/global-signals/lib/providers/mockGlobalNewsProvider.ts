import type { GlobalNewsProvider, RawGlobalArticle } from './types';

// Timestamps are relative to now so they look fresh on every server start.
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

const MOCK_ARTICLES: RawGlobalArticle[] = [
  {
    id: 'mock-1',
    title: 'NVIDIA Reports Record AI Chip Revenue, Data Center Sales Surge 120%',
    summary: 'NVIDIA reported record quarterly revenue driven by strong demand for AI semiconductor chips, with data center revenue surging 120% year-over-year as hyperscalers ramp up GPU orders for generative AI workloads.',
    source: 'Reuters',
    publishedAt: hoursAgo(3),
    url: '#',
  },
  {
    id: 'mock-2',
    title: 'Federal Reserve Signals Rate Hold as Inflation Remains Above Target',
    summary: 'Fed Chair Jerome Powell indicated the central bank will hold interest rates at current levels after the FOMC meeting, with monetary policy remaining restrictive as inflation has not yet shown sufficient progress toward the 2% target.',
    source: 'Bloomberg',
    publishedAt: hoursAgo(5),
    url: '#',
  },
  {
    id: 'mock-3',
    title: 'Tesla EV Deliveries Miss Expectations, Lithium Battery Supply Chain Under Pressure',
    summary: 'Tesla reported quarterly deliveries that fell short of analyst estimates as electric vehicle demand softens globally. Lithium battery suppliers face weaker orders, and EV production cuts loom across the industry.',
    source: 'Financial Times',
    publishedAt: hoursAgo(7),
    url: '#',
  },
  {
    id: 'mock-4',
    title: 'TSMC Raises Full-Year Guidance on Surging AI Semiconductor Demand',
    summary: 'Taiwan Semiconductor Manufacturing Company raised its full-year revenue guidance, citing surging demand for advanced semiconductor chips used in AI applications. TSMC said AI-related chip revenue will double this year.',
    source: 'Wall Street Journal',
    publishedAt: hoursAgo(9),
    url: '#',
  },
  {
    id: 'mock-5',
    title: 'S&P 500 Falls on Treasury Yield Spike, Nasdaq Selloff Deepens',
    summary: 'The S&P 500 declined 1.2% and the Nasdaq selloff deepened after strong jobs data prompted investors to price in fewer Federal Reserve rate cuts. Treasury yields rose sharply, triggering a broad equity market drop.',
    source: 'CNBC',
    publishedAt: hoursAgo(11),
    url: '#',
  },
  {
    id: 'mock-6',
    title: 'AMD Launches MI300X AI Accelerator Chip, Challenges NVIDIA in Data Center',
    summary: 'Advanced Micro Devices unveiled its next-generation MI300X AI accelerator chip, claiming significant performance gains for AI training workloads and targeting NVIDIA\'s dominant semiconductor market share in the GPU space.',
    source: 'The Verge',
    publishedAt: hoursAgo(14),
    url: '#',
  },
  {
    id: 'mock-7',
    title: 'Lithium Battery Prices Recover as Electric Vehicle Demand Outlook Improves',
    summary: 'Lithium carbonate prices rose for a third consecutive week as battery manufacturers reported improving order visibility. LG Energy Solution and Samsung SDI noted stronger EV battery demand from European automakers.',
    source: 'Reuters',
    publishedAt: hoursAgo(18),
    url: '#',
  },
  {
    id: 'mock-8',
    title: 'OpenAI Raises $10B, Partners with Semiconductor Firms for Custom AI Chips',
    summary: 'OpenAI secured $10 billion in new funding and announced partnerships with leading semiconductor manufacturers to develop custom AI chips, reducing dependence on NVIDIA GPUs for training large language models.',
    source: 'TechCrunch',
    publishedAt: hoursAgo(22),
    url: '#',
  },
];

export const mockGlobalNewsProvider: GlobalNewsProvider = {
  async fetchNews(): Promise<RawGlobalArticle[]> {
    return MOCK_ARTICLES;
  },
};
