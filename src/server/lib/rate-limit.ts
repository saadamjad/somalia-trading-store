/**
 * In-memory sliding-window rate limiter.
 *
 * Scope note (docs/DECISIONS.md D-001/D-005 "keep it simple, no unnecessary
 * infrastructure"): this app is a single Next.js instance with no Redis/external
 * cache. An in-memory Map keyed by `${routeKey}:${ip}` is correct and sufficient for
 * that deployment model, but it is per-process state — if this app is ever
 * horizontally scaled to multiple instances, each instance would enforce its own
 * independent limit (an attacker could get N x the effective limit by hitting
 * different instances). If/when horizontal scaling happens, this must move to a
 * shared store (e.g. Redis) keyed the same way. Documented here and in
 * docs/DECISIONS.md so it isn't missed.
 */

type Bucket = {
  /** Timestamps (ms) of requests within the current window, oldest first. */
  hits: number[];
};

const buckets = new Map<string, Bucket>();

/** Guards against unbounded memory growth from many distinct IPs over time. */
const MAX_TRACKED_KEYS = 50_000;

export type RateLimitResult = {
  allowed: boolean;
  /** Milliseconds until the caller may retry, only meaningful when `allowed` is false. */
  retryAfterMs: number;
  remaining: number;
  limit: number;
};

/**
 * Sliding-window check: allows at most `limit` hits per `windowMs` for `key`.
 * Records the hit immediately when allowed (so concurrent callers can't race past
 * the limit within the same tick).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= MAX_TRACKED_KEYS) {
      pruneOldestBuckets(now, windowMs);
    }
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }

  const windowStart = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > windowStart);

  if (bucket.hits.length >= limit) {
    const retryAfterMs = bucket.hits[0] + windowMs - now;
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0), remaining: 0, limit };
  }

  bucket.hits.push(now);
  return { allowed: true, retryAfterMs: 0, remaining: limit - bucket.hits.length, limit };
}

/** Drops buckets with no hits inside the current window to bound memory use. */
function pruneOldestBuckets(now: number, windowMs: number) {
  const windowStart = now - windowMs;
  for (const [key, bucket] of buckets) {
    const stillActive = bucket.hits.some((t) => t > windowStart);
    if (!stillActive) buckets.delete(key);
  }
}

/** Test-only: clears all rate-limit state between test cases. */
export function __resetRateLimitStateForTests() {
  buckets.clear();
}

/**
 * Best-effort client IP extraction for rate-limit keying. Trusts `x-forwarded-for`
 * (set by the platform's edge/proxy in real deployments; Vercel and most reverse
 * proxies set this) and falls back to a constant so requests without any forwarded
 * header still share one (heavily-limited) bucket rather than bypassing limiting
 * entirely.
 */
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]!.trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Named rate-limit policies for sensitive endpoints (spec cross-cutting standard). */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 60_000 },
  register: { limit: 5, windowMs: 60_000 },
  forgotPassword: { limit: 5, windowMs: 60_000 },
  resetPassword: { limit: 10, windowMs: 60_000 },
  checkout: { limit: 10, windowMs: 60_000 },
  quote: { limit: 10, windowMs: 60_000 },
} as const;
