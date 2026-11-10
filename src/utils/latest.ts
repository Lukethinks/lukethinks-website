// src/utils/latest.ts — "what is new on the site", across writing and audio.
import { getPodcast } from './episodes';
import { getWriting } from './writing';

export interface LatestItem {
  kind: 'Essay' | 'Episode';
  href: string;
  title: string;
  summary: string;
  published: Date;
  publishedIso: string;
  publishedHuman: string;
  meta: string;
}

/** Newest first. On the same day, episodes sort by episode number (higher = newer). */
export async function getLatest(limit = 5): Promise<LatestItem[]> {
  const [{ episodes }, writing] = await Promise.all([getPodcast(), getWriting()]);

  const rows: Array<LatestItem & { order: number }> = [
    ...writing.map((w) => ({
      kind: 'Essay' as const,
      href: w.href,
      title: w.title,
      summary: w.summary,
      published: w.published,
      publishedIso: w.publishedIso,
      publishedHuman: w.publishedHuman,
      meta: w.category,
      order: 0,
    })),
    ...episodes.map((e) => ({
      kind: 'Episode' as const,
      href: e.href,
      title: e.title,
      summary: e.summary,
      published: e.published,
      publishedIso: e.publishedIso,
      publishedHuman: e.publishedHuman,
      meta: `Episode ${e.episode} · ${e.durationLabel}`,
      order: e.episode,
    })),
  ];

  return rows
    .sort((a, b) => b.published.getTime() - a.published.getTime() || b.order - a.order)
    .slice(0, limit)
    .map(({ order, ...item }) => item);
}
