import type { NextRequest } from 'next/server';
import { getNewsProvider } from '@/features/market-news/lib/providers/getNewsProvider';
import type { NewsResponse } from '@/features/market-news/lib/providers/types';

export async function GET(request: NextRequest): Promise<Response> {
  const keyword = request.nextUrl.searchParams.get('keyword') ?? '반도체';
  const display = Number(request.nextUrl.searchParams.get('display') ?? '10');

  const { provider, providerType } = getNewsProvider();

  const fetchedAt = new Date().toISOString();

  try {
    const articles = await provider.fetchNews({ keyword, display });
    const body: NewsResponse = { articles, providerType, fetchedAt, fallbackReason: null, queryDiagnostics: [{ keyword, ok: true, count: articles.length }] };
    return Response.json(body);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    console.error('[news/route] provider failed:', errMsg);
    const body: NewsResponse = { articles: [], providerType, fetchedAt, fallbackReason: `provider-error: ${errMsg}`, queryDiagnostics: [{ keyword, ok: false, count: 0, errorMessage: errMsg }] };
    return Response.json(body, { status: 500 });
  }
}
