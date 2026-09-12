import { Redis } from '@upstash/redis';
import { KV_REST_API_URL, KV_REST_API_TOKEN } from 'astro:env/server';

export const REACTION_KEYS = ['useful', 'changed_mind', 'more_depth'] as const;
export type ReactionKind = (typeof REACTION_KEYS)[number];

export interface ReactionCounts {
  useful: number | null;
  changed_mind: number | null;
  more_depth: number | null;
}

let redisInstance: Redis | null = null;

function getRedisInstance(): Redis {
  if (!redisInstance) {
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
      throw new Error('KV_REST_API_URL or KV_REST_API_TOKEN is not configured');
    }
    redisInstance = new Redis({
      url: KV_REST_API_URL,
      token: KV_REST_API_TOKEN,
    });
  }
  return redisInstance;
}

export function getReactionKey(slug: string, kind: string): string {
  return `reactions:${slug}:${kind}`;
}

export function normalizeReactionKind(kind: string): ReactionKind | null {
  if (!kind || typeof kind !== 'string') return null;
  const k = kind.toLowerCase().trim().replace(/[-\s]+/g, '_');
  if (k === 'useful') return 'useful';
  if (k === 'changed_mind' || k === 'changed_my_mind') return 'changed_mind';
  if (k === 'more_depth' || k === 'want_more_depth') return 'more_depth';
  return null;
}

function parseCount(val: unknown): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Thin Redis client (incr, mget only) using @upstash/redis.
 * Fails soft on read (Redis down -> hide counts, never break the page),
 * fails loud on write.
 */
export const redisClient = {
  /**
   * Atomic increment for a single key.
   * Fails loud on write.
   */
  async incr(key: string): Promise<number> {
    const redis = getRedisInstance();
    // Atomic INCR in Redis - errors are NOT caught, failing loud
    return await redis.incr(key);
  },

  /**
   * Mget for multiple keys.
   * Fails soft on read: returns null if Redis fails or is unreachable.
   */
  async mget<T = unknown>(...keys: string[]): Promise<(T | null)[] | null> {
    if (keys.length === 0) return [];
    try {
      const redis = getRedisInstance();
      const results = await redis.mget<T[]>(...keys);
      return results;
    } catch (err) {
      console.warn('[redisClient.mget] Read failed soft:', err instanceof Error ? err.message : err);
      // Soft failure: return null to indicate read failure
      return null;
    }
  },

  /**
   * Ping for health check route.
   */
  async ping(): Promise<boolean> {
    try {
      const redis = getRedisInstance();
      const res = await redis.ping();
      return res === 'PONG';
    } catch (err) {
      console.warn('[redisClient.ping] Ping failed:', err instanceof Error ? err.message : err);
      return false;
    }
  },
};

/**
 * Fetch reaction counts for an article.
 * Fails soft: returns null if Redis is unreachable or fails.
 */
export async function getArticleReactionCounts(slug: string): Promise<ReactionCounts | null> {
  const keys = REACTION_KEYS.map((kind) => getReactionKey(slug, kind));
  const values = await redisClient.mget<number | string | null>(...keys);
  if (!values) {
    return null;
  }
  return {
    useful: parseCount(values[0]),
    changed_mind: parseCount(values[1]),
    more_depth: parseCount(values[2]),
  };
}

/**
 * Atomically increment a reaction count.
 * Fails loud: error propagates directly.
 */
export async function incrementReaction(slug: string, kind: ReactionKind): Promise<number> {
  const key = getReactionKey(slug, kind);
  return await redisClient.incr(key);
}
