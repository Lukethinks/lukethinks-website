// src/utils/writing.ts — the written pieces and what is connected to each.
// One place for "what has Luke written, and is there audio for it?", so the Writing
// index and the home page cannot disagree.
import { getCollection } from 'astro:content';
import { getEpisodesFor } from './episodes';

export interface WritingItem {
  slug: string;
  href: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  confidence?: string;
  published: Date;
  publishedIso: string;
  publishedHuman: string;
  episodeCount: number;
}

const humanDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Published articles, newest first.
 * Only articles have a detail route today; research/ and learnings/ entries join this
 * list once their [slug] pages exist (the collections are already in the schema).
 */
export async function getWriting(): Promise<WritingItem[]> {
  const articles = await getCollection('articles', ({ data }) => data.status === 'published');
  const items = await Promise.all(
    articles.map(async (a) => ({
      slug: a.data.slug,
      href: `/articles/${a.data.slug}`,
      title: a.data.title,
      summary: a.data.summary,
      category: a.data.category,
      tags: a.data.tags,
      confidence: a.data.confidence,
      published: a.data.published,
      publishedIso: a.data.published.toISOString().slice(0, 10),
      publishedHuman: humanDate(a.data.published),
      episodeCount: (await getEpisodesFor(a.data.slug)).length,
    })),
  );
  return items.sort((a, b) => b.published.getTime() - a.published.getTime() || a.title.localeCompare(b.title));
}
