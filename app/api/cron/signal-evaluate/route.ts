import type { NextRequest } from 'next/server';
import { fetchCandlesForTicker } from '@/features/paper-trading/lib/candles/fetchCandles';
import { evaluateSignalWithCandles } from '@/features/watchlist/lib/signalEvaluator';
import type { TrackedSignal } from '@/features/watchlist/lib/signalTrackingTypes';

/**
 * Stub for server-side batch evaluation (e.g. Vercel Cron).
 * Client-side localStorage is the primary store; pass pending logs in body.
 */
export async function POST(request: NextRequest): Promise<Response> {
  let pending: TrackedSignal[] = [];
  try {
    const body = (await request.json()) as { pending?: TrackedSignal[] };
    pending = body.pending ?? [];
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 });
  }

  const evaluated: TrackedSignal[] = [];

  for (const record of pending) {
    const data = await fetchCandlesForTicker(record.ticker, 90);
    const evaluation = evaluateSignalWithCandles(record, data.candles);
    if (evaluation) {
      evaluated.push({ ...record, status: 'evaluated', evaluation });
    }
  }

  return Response.json({
    evaluatedCount: evaluated.length,
    evaluated,
    fetchedAt: new Date().toISOString(),
  });
}
