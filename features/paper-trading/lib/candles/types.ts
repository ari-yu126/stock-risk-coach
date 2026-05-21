export interface Candle {
  date: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  ticker: string;
  name: string;
  candles: Candle[];
  source: 'naver-fchart' | 'synthetic';
  days: number;
}
