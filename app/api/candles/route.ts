import type { NextRequest } from 'next/server';
import { fetchCandlesForTicker } from '@/features/paper-trading/lib/candles/fetchCandles';

export async function GET(request: NextRequest): Promise<Response> {
  const ticker = request.nextUrl.searchParams.get('ticker') ?? '005930';
  const days = Math.min(250, Math.max(60, parseInt(request.nextUrl.searchParams.get('days') ?? '120', 10) || 120));

  const data = await fetchCandlesForTicker(ticker, days);
  return Response.json(data);
}
