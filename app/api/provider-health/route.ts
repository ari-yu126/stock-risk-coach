import { probeFinanceEndpoints } from '@/features/market-data/lib/providers/naverFinanceProvider';

const HEALTH_NEWS_KEYWORD = '반도체';
const HEALTH_FINANCE_TICKER = '005930';

export interface ProviderHealthResponse {
  news: {
    providerType: 'naver' | 'mock';
    ok: boolean;
    diagnostics: {
      hasClientId: boolean;
      hasClientSecret: boolean;
      test: {
        keyword: string;
        httpStatus: number | null;
        articleCount: number | null;
        errorMessage: string | null;
      } | null; // null when credentials are missing (no request made)
    };
  };
  market: {
    providerType: 'naver-finance';
    ok: boolean;
    diagnostics: {
      ticker: string;
      endpoints: {
        endpoint: 'primary' | 'polling';
        url: string;
        httpStatus: number | null;
        ok: boolean;
        responsePreview: string | null;
        error: string | null;
      }[];
    };
  };
  checkedAt: string;
}

async function checkNews(): Promise<ProviderHealthResponse['news']> {
  const hasClientId = Boolean(process.env.NAVER_CLIENT_ID);
  const hasClientSecret = Boolean(process.env.NAVER_CLIENT_SECRET);

  if (!hasClientId || !hasClientSecret) {
    return {
      providerType: 'mock',
      ok: false,
      diagnostics: { hasClientId, hasClientSecret, test: null },
    };
  }

  const url = new URL('https://openapi.naver.com/v1/search/news.json');
  url.searchParams.set('query', HEALTH_NEWS_KEYWORD);
  url.searchParams.set('display', '1');
  url.searchParams.set('sort', 'date');

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID ?? '',
        'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET ?? '',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        providerType: 'naver',
        ok: false,
        diagnostics: {
          hasClientId,
          hasClientSecret,
          test: {
            keyword: HEALTH_NEWS_KEYWORD,
            httpStatus: res.status,
            articleCount: null,
            errorMessage: body.slice(0, 300),
          },
        },
      };
    }

    const data = (await res.json()) as { items?: unknown[] };
    const articleCount = Array.isArray(data.items) ? data.items.length : 0;

    return {
      providerType: 'naver',
      ok: articleCount > 0,
      diagnostics: {
        hasClientId,
        hasClientSecret,
        test: {
          keyword: HEALTH_NEWS_KEYWORD,
          httpStatus: res.status,
          articleCount,
          errorMessage: articleCount === 0 ? 'HTTP 200 but items array is empty' : null,
        },
      },
    };
  } catch (err) {
    return {
      providerType: 'naver',
      ok: false,
      diagnostics: {
        hasClientId,
        hasClientSecret,
        test: {
          keyword: HEALTH_NEWS_KEYWORD,
          httpStatus: null,
          articleCount: null,
          errorMessage: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
        },
      },
    };
  }
}

async function checkMarket(): Promise<ProviderHealthResponse['market']> {
  const endpoints = await probeFinanceEndpoints(HEALTH_FINANCE_TICKER);
  const anyOk = endpoints.some((e) => e.ok);

  return {
    providerType: 'naver-finance',
    ok: anyOk,
    diagnostics: {
      ticker: HEALTH_FINANCE_TICKER,
      endpoints,
    },
  };
}

export async function GET(): Promise<Response> {
  const [news, market] = await Promise.all([checkNews(), checkMarket()]);

  const body: ProviderHealthResponse = {
    news,
    market,
    checkedAt: new Date().toISOString(),
  };

  console.log('[provider-health]', JSON.stringify({ newsOk: news.ok, marketOk: market.ok }));

  return Response.json(body);
}
