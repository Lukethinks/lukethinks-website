import crypto from 'node:crypto';
import { redisClient } from './redis';

export const COOKIE_NAME = 'lt_reactions';

export const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 365 * 24 * 60 * 60, // 1 year
};

export interface ReactionVotes {
  [slug: string]: string; // slug -> kind
}

function signPayload(payload: string, secret: string): string {
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Sign reaction votes into a tamper-evident string,
 * strictly capped below 2KB (2048 bytes).
 */
export function serializeReactionsCookie(votes: ReactionVotes, secret: string, maxBytes: number = 1900): string {
  const copy: ReactionVotes = { ...votes };
  const keys = Object.keys(copy);

  while (keys.length > 0) {
    const payload = Buffer.from(JSON.stringify(copy)).toString('base64url');
    const signed = signPayload(payload, secret);
    if (Buffer.byteLength(signed, 'utf8') <= maxBytes || keys.length <= 1) {
      return signed;
    }
    // Drop the oldest entry to stay under the 2KB cap
    const oldestKey = keys.shift()!;
    delete copy[oldestKey];
  }

  const fallbackPayload = Buffer.from(JSON.stringify(copy)).toString('base64url');
  return signPayload(fallbackPayload, secret);
}

/**
 * Verify and parse a signed reactions cookie.
 * Returns empty object if cookie is missing, tampered with, or invalid.
 */
export function getVotesFromCookie(cookieValue: string | undefined | null, secret: string): ReactionVotes {
  const empty: ReactionVotes = Object.create(null);
  if (!cookieValue) return empty;

  let val = cookieValue.trim();
  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    val = val.slice(1, -1);
  }

  const dotIndex = val.lastIndexOf('.');
  if (dotIndex === -1) return empty;

  const payload = val.slice(0, dotIndex);
  const signature = val.slice(dotIndex + 1);

  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  try {
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return empty;
    }

    const jsonStr = Buffer.from(payload, 'base64url').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const clean: ReactionVotes = Object.create(null);
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && typeof k === 'string') {
          clean[k] = v;
        }
      }
      return clean;
    }
  } catch {
    // Malformed JSON or base64
  }

  return empty;
}

/**
 * Hash an IP address with HMAC-SHA256.
 * The raw IP is never persisted or logged.
 */
export function hashIp(ip: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(ip).digest('hex');
}

/**
 * Rate limit requests by hashed IP address using atomic Redis INCR.
 * Allows up to 15 reaction submissions per 1-minute window.
 */
export async function checkRateLimit(request: Request, secret: string, limit: number = 15): Promise<boolean> {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = (forwarded ? forwarded.split(',')[0].trim() : null)
    || request.headers.get('x-real-ip')
    || '127.0.0.1';

  const ipHash = hashIp(ip, secret);
  const minuteWindow = Math.floor(Date.now() / 60000);
  const rateLimitKey = `reactions:rl:${ipHash}:${minuteWindow}`;

  // Atomic increment via thin client
  const count = await redisClient.incr(rateLimitKey);
  return count <= limit;
}
