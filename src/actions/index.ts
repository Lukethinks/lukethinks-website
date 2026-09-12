import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { getCollection } from 'astro:content';
import { REACTIONS_COOKIE_SECRET } from 'astro:env/server';
import {
  incrementReaction,
  getArticleReactionCounts,
  normalizeReactionKind,
  REACTION_KEYS,
} from '../utils/redis';
import {
  COOKIE_NAME,
  COOKIE_OPTIONS,
  getVotesFromCookie,
  serializeReactionsCookie,
  checkRateLimit,
} from '../utils/reactions-cookie';

async function validateArticleSlug(slug: string): Promise<boolean> {
  const clean = slug.trim();
  const articles = await getCollection('articles');
  return articles.some((a) => a.data.slug === clean || a.id === clean);
}

export const server = {
  react: defineAction({
    input: z.object({
      slug: z.string(),
      kind: z.string(),
    }),
    handler: async ({ slug, kind }, context) => {
      const cleanSlug = slug.trim();

      // 1. Validate slug against existing articles collection
      const isValidSlug = await validateArticleSlug(cleanSlug);
      if (!isValidSlug) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `Article '${cleanSlug}' not found.`,
        });
      }

      // 2. Validate and normalize kind
      const normalizedKind = normalizeReactionKind(kind);
      if (!normalizedKind) {
        throw new ActionError({
          code: 'BAD_REQUEST',
          message: `Invalid reaction kind '${kind}'. Must be one of: ${REACTION_KEYS.join(', ')}.`,
        });
      }

      // 3. Prevent repeat votes via signed cookie
      const existingCookie = context.cookies.get(COOKIE_NAME)?.value;
      const votes = getVotesFromCookie(existingCookie, REACTIONS_COOKIE_SECRET);

      if (votes[cleanSlug]) {
        throw new ActionError({
          code: 'CONFLICT',
          message: 'You have already reacted to this article.',
        });
      }

      // 4. Rate limit by hashed IP
      const allowed = await checkRateLimit(context.request, REACTIONS_COOKIE_SECRET);
      if (!allowed) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please try again later.',
        });
      }

      // 5. Atomic increment only (fails loud on write)
      await incrementReaction(cleanSlug, normalizedKind);

      // 6. Update signed cookie
      votes[cleanSlug] = normalizedKind;
      const updatedCookie = serializeReactionsCookie(votes, REACTIONS_COOKIE_SECRET);
      context.cookies.set(COOKIE_NAME, updatedCookie, COOKIE_OPTIONS);

      // 7. Return updated counts
      const counts = await getArticleReactionCounts(cleanSlug);

      return {
        success: true,
        userReaction: normalizedKind,
        counts,
      };
    },
  }),

  getCounts: defineAction({
    input: z.object({
      slug: z.string(),
    }),
    handler: async ({ slug }, context) => {
      const cleanSlug = slug.trim();
      const isValidSlug = await validateArticleSlug(cleanSlug);
      if (!isValidSlug) {
        throw new ActionError({
          code: 'NOT_FOUND',
          message: `Article '${cleanSlug}' not found.`,
        });
      }

      const counts = await getArticleReactionCounts(cleanSlug);

      const existingCookie = context.cookies.get(COOKIE_NAME)?.value;
      const votes = getVotesFromCookie(existingCookie, REACTIONS_COOKIE_SECRET);
      const userReaction = votes[cleanSlug] || null;

      return {
        counts,
        userReaction,
      };
    },
  }),
};
