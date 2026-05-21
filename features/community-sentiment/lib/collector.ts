import type { CommunitySentimentResponse } from '../types';
import { COMMUNITY_TRACK_TICKERS } from './config';
import { createFetchLog } from './collectDebug';
import { collectLiveCommunitySentiment, attachDebug } from './liveCollector';
import { collectMockCommunitySentiment } from './mockCollector';

/**
 * Community data collector with structured debug logs.
 * Mock fallback only when market + jongto critical path both fail.
 */
export async function collectCommunitySentiment(): Promise<CommunitySentimentResponse> {
  const fetchStartedAt = new Date().toISOString();
  const started = Date.now();

  const live = await collectLiveCommunitySentiment();

  if (live.canLive) {
    const result = attachDebug(
      {
        ...live.response,
        dataKind: 'live',
        providerType: 'live',
      },
      live.logs,
      live.summary,
      fetchStartedAt,
      Date.now() - started,
      {
        sourceStatuses: live.sourceStatuses,
        warnings: live.warnings,
      },
    );
    console.info(
      `[community] LIVE items=${live.summary.tickersWithData} discuss=${live.summary.discussPosts} warnings=${live.warnings?.length ?? 0} ${result.debug?.fetchDurationMs}ms`,
    );
    return result;
  }

  const fallbackMessage = live.fallbackReason ?? 'critical path failed';
  const logs = [
    ...live.logs,
    createFetchLog({
      source: 'collector',
      code: 'FALLBACK_MOCK_COLLECT',
      message: `mock fallback: ${fallbackMessage}`,
      durationMs: Date.now() - started,
    }),
  ];

  console.error(`[community] FALLBACK_MOCK_COLLECT reason=${fallbackMessage}`);

  const mock = collectMockCommunitySentiment();
  return attachDebug(
    {
      ...mock,
      dataKind: 'mock',
      providerType: 'mock',
    },
    logs,
    {
      tickersRequested: COMMUNITY_TRACK_TICKERS.length,
      tickersWithData: mock.items.length,
      discussPosts: 0,
      searchDcPosts: 0,
      searchFmPosts: 0,
      totalPosts: 0,
    },
    fetchStartedAt,
    Date.now() - started,
    {
      fallbackCode: 'FALLBACK_MOCK_COLLECT',
      fallbackMessage,
      sourceStatuses: live.sourceStatuses,
      warnings: live.warnings,
    },
  );
}
