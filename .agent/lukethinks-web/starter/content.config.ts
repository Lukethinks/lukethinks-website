// src/content.config.ts — THE content contract (ADR-0012). Edit fields here and nowhere else.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const iso = z.coerce.date();
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case only');

const production = z.object({
  source: z.enum(['notebooklm', 'elevenlabs', 'human', 'mixed']),
  voices: z.number().int().min(1).optional(),
  aiDisclosed: z.boolean().optional(),
}).refine(p => p.source === 'human' || p.aiDisclosed === true, {
  message: 'AI-produced audio must set aiDisclosed: true',
});

const companionAudio = z.object({
  label: z.string(),
  src: z.string().url().startsWith('https://'),
  variant: z.enum(['narration', 'debate', 'summary']),
  bytes: z.number().int().positive(),
  durationSeconds: z.number().int().positive(),
  production,
});

const core = z.object({
  title: z.string().min(1),
  slug,
  summary: z.string().min(1).max(300),
  published: iso,
  updated: iso.optional(),
  status: z.enum(['draft', 'published', 'archived']),
  lang: z.enum(['en', 'nl']).default('en'),
  tags: z.array(z.string()).min(1),
  related: z.array(slug).optional(),
  series: z.string().optional(),
  seriesPart: z.number().int().min(1).optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

const prose = core.extend({
  category: z.string(),
  subtitle: z.string().optional(),
  hero: z.object({ src: z.string(), alt: z.string() }).optional(),
  toc: z.boolean().default(true),
  audio: z.array(companionAudio).default([]),
  sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
});

const md = (base: string) => glob({ pattern: '**/[^_]*.md', base, generateId: ({ entry }) => entry.replace(/\.md$/, '') });
const notSidecar = (base: string) => glob({ pattern: ['**/*.md', '!**/*.linkedin.md'], base });

export const collections = {
  articles: defineCollection({ loader: notSidecar('./content/articles'), schema: prose.extend({ type: z.literal('article') }) }),
  research: defineCollection({ loader: notSidecar('./content/research'), schema: prose.extend({ type: z.literal('research') }) }),
  learnings: defineCollection({
    loader: notSidecar('./content/learnings'),
    schema: prose.extend({
      type: z.literal('learning'),
      format: z.enum(['note', 'experiment', 'breakdown']),
      state: z.enum(['in-progress', 'concluded', 'abandoned']),
      question: z.string(),
      hypothesis: z.string().optional(),
      started: iso,
      concluded: iso.optional(),
      outcome: z.enum(['supported', 'refuted', 'partial', 'inconclusive']).nullable().default(null),
    }).refine(l => l.format !== 'experiment' || !!l.hypothesis, { message: 'An experiment needs a hypothesis' }),
  }),
  episodes: defineCollection({
    loader: notSidecar('./content/episodes'),
    schema: core.extend({
      type: z.literal('episode'),
      episode: z.number().int().min(1),
      season: z.number().int().min(1).default(1),
      guid: z.string().regex(/^lukethinks-ep-\d{3}$/),
      explicit: z.boolean().default(false),
      transcript: z.boolean().default(true), // file at public/transcripts/<slug>.vtt
      chapters: z.array(z.object({ start: z.number().int().min(0), title: z.string() })).default([]),
      audio: z.object({
        src: z.string().url().startsWith('https://'),
        bytes: z.number().int().positive(),
        durationSeconds: z.number().int().positive(),
        mimeType: z.literal('audio/mpeg').default('audio/mpeg'),
      }),
      production,
    }),
  }),
};
