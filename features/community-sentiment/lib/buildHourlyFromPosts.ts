import type { CommunityPost, HourlySnapshot } from '../types';

/** Aggregate last 24h posts into hourly mention/sentiment buckets. */
export function buildHourlyFromPosts(
  posts: CommunityPost[],
  volumeRatio: number,
): HourlySnapshot[] {
  const now = Date.now();
  const points: HourlySnapshot[] = [];

  for (let h = 23; h >= 0; h--) {
    const t = new Date(now - h * 3_600_000);
    const hourStart = t.getTime();
    const hourEnd = hourStart + 3_600_000;

    const inHour = posts.filter((p) => {
      const ts = new Date(p.publishedAt).getTime();
      return ts >= hourStart && ts < hourEnd;
    });

    const mentionCount = inHour.length;
    const sentimentScore =
      mentionCount > 0
        ? Math.round(inHour.reduce((s, p) => s + p.sentimentScore, 0) / mentionCount)
        : 50;

    points.push({
      hour: t.toISOString(),
      mentionCount,
      sentimentScore,
      volumeRatio: Math.max(0.3, volumeRatio * (0.85 + (mentionCount / 20) * 0.3)),
    });
  }

  return points;
}

export function calcMentionGrowth(posts: CommunityPost[]): number {
  const now = Date.now();
  const last12h = posts.filter((p) => now - new Date(p.publishedAt).getTime() < 12 * 3_600_000).length;
  const prev12h = posts.filter((p) => {
    const age = now - new Date(p.publishedAt).getTime();
    return age >= 12 * 3_600_000 && age < 24 * 3_600_000;
  }).length;

  if (prev12h === 0) return last12h > 0 ? Math.min(3, 1 + last12h / 8) : 1;
  return last12h / prev12h;
}
