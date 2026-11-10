// src/utils/episodes.ts — one place that answers "what is the latest episode, and what
// is each episode connected to?". Every podcast surface (index, episode page, article
// page) reads from here, so the answers cannot disagree between pages.
import { getCollection, type CollectionEntry } from 'astro:content';
import podcast from '../../content/podcast.json';

export type Episode = CollectionEntry<'episodes'>;

export interface EpisodeLink {
  slug: string;
  href: string;
  title: string;
  episode: number;
  durationSeconds: number;
}

export interface SeriesPart extends EpisodeLink {
  part: number;
  isCurrent: boolean;
}

export interface SeriesInfo {
  title: string;
  anchor: string;
  summary?: string;
  part: number;
  total: number;
  totalSeconds: number;
  parts: SeriesPart[];
}

export interface ReadingLink {
  title: string;
  href: string;
  kind: string;
}

export interface EpisodeView {
  entry: Episode;
  slug: string;
  href: string;
  title: string;
  summary: string;
  episode: number;
  published: Date;
  publishedIso: string;
  publishedHuman: string;
  durationSeconds: number;
  durationLabel: string;
  format: 'debate' | 'briefing';
  formatLabel: string;
  tags: string[];
  takeaways: string[];
  audioSrc: string;
  aiDisclosed: boolean;
  series?: SeriesInfo;
  reading: ReadingLink[];
  newer?: EpisodeLink;
  older?: EpisodeLink;
}

export interface SeriesView {
  title: string;
  anchor: string;
  summary?: string;
  totalSeconds: number;
  latestPublishedHuman: string;
  parts: EpisodeView[];
}

const slugify = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const isoDuration = (seconds: number) => `PT${Math.max(1, Math.round(seconds / 60))}M`;

const humanDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const link = (e: Episode): EpisodeLink => ({
  slug: e.data.slug,
  href: `/podcast/${e.data.slug}`,
  title: e.data.title,
  episode: e.data.episode,
  durationSeconds: e.data.audio.durationSeconds,
});

const READING_KIND: Record<string, string> = { article: 'Essay', research: 'Research', learning: 'Learning note' };
const READING_BASE: Record<string, string> = { article: '/articles', research: '/research', learning: '/learning' };

let cache: Promise<{ episodes: EpisodeView[]; series: SeriesView[] }> | undefined;

async function build() {
  const published = ({ data }: { data: { status: string } }) => data.status === 'published';
  const [episodes, articles, research, learnings] = await Promise.all([
    getCollection('episodes', published),
    getCollection('articles', published),
    getCollection('research', published),
    getCollection('learnings', published),
  ]);

  // Newest first. Episodes released on the same day fall back to episode number.
  const sorted = [...episodes].sort(
    (a, b) => b.data.published.getTime() - a.data.published.getTime() || b.data.episode - a.data.episode,
  );

  const written = new Map<string, ReadingLink>();
  for (const e of [...articles, ...research, ...learnings]) {
    written.set(e.data.slug, {
      title: e.data.title,
      href: `${READING_BASE[e.data.type]}/${e.data.slug}`,
      kind: READING_KIND[e.data.type],
    });
  }

  const seriesMeta = new Map((podcast.series ?? []).map((s) => [s.title, s]));
  const bySeries = new Map<string, Episode[]>();
  for (const e of sorted) {
    if (!e.data.series) continue;
    bySeries.set(e.data.series, [...(bySeries.get(e.data.series) ?? []), e]);
  }
  for (const list of bySeries.values()) {
    list.sort((a, b) => (a.data.seriesPart ?? a.data.episode) - (b.data.seriesPart ?? b.data.episode));
  }

  const views: EpisodeView[] = sorted.map((e, i) => {
    const d = e.data;
    const isDebate = d.title.toLowerCase().includes('debate') || d.audio.src.toLowerCase().includes('debate');
    const siblings = d.series ? bySeries.get(d.series)! : [];
    const series: SeriesInfo | undefined = d.series
      ? {
          title: d.series,
          anchor: `series-${slugify(d.series)}`,
          summary: seriesMeta.get(d.series)?.summary,
          part: siblings.indexOf(e) + 1,
          total: siblings.length,
          totalSeconds: siblings.reduce((n, s) => n + s.data.audio.durationSeconds, 0),
          parts: siblings.map((s, idx) => ({ ...link(s), part: idx + 1, isCurrent: s === e })),
        }
      : undefined;

    return {
      entry: e,
      slug: d.slug,
      href: `/podcast/${d.slug}`,
      title: d.title,
      summary: d.summary,
      episode: d.episode,
      published: d.published,
      publishedIso: d.published.toISOString().slice(0, 10),
      publishedHuman: humanDate(d.published),
      durationSeconds: d.audio.durationSeconds,
      durationLabel: formatDuration(d.audio.durationSeconds),
      format: isDebate ? 'debate' : 'briefing',
      formatLabel: isDebate ? 'Debate' : 'Briefing',
      tags: d.tags,
      takeaways: d.takeaways,
      audioSrc: d.audio.src,
      aiDisclosed: d.production.aiDisclosed === true,
      series,
      reading: (d.related ?? []).map((s) => written.get(s)).filter((r): r is ReadingLink => !!r),
      newer: i > 0 ? link(sorted[i - 1]) : undefined,
      older: i < sorted.length - 1 ? link(sorted[i + 1]) : undefined,
    };
  });

  const bySlug = new Map(views.map((v) => [v.slug, v]));
  const series: SeriesView[] = [...bySeries.entries()].map(([title, list]) => {
    const parts = list.map((e) => bySlug.get(e.data.slug)!);
    const newest = parts.reduce((a, b) => (b.published > a.published ? b : a));
    return {
      title,
      anchor: `series-${slugify(title)}`,
      summary: seriesMeta.get(title)?.summary,
      totalSeconds: parts.reduce((n, p) => n + p.durationSeconds, 0),
      latestPublishedHuman: newest.publishedHuman,
      parts,
    };
  });

  return { episodes: views, series };
}

/** All published episodes, newest first, with their connections resolved. */
export async function getPodcast() {
  cache ??= build();
  return cache;
}

/** Episodes that name this article/research/learning slug in their `related` field. */
export async function getEpisodesFor(writtenSlug: string): Promise<EpisodeView[]> {
  const { episodes } = await getPodcast();
  return episodes
    .filter((e) => (e.entry.data.related ?? []).includes(writtenSlug))
    .sort((a, b) => a.episode - b.episode);
}
