/**
 * Load armour for the API routes. Three small tools, all in-memory and
 * per-instance, which is exactly the scope that matters: one busy serverless
 * instance must never multiply one viral token into a hundred chain reads.
 *
 *  - coalesce: concurrent identical requests share one in-flight promise
 *  - TtlCache: results cached with an age-aware TTL (old grades barely move)
 *  - RateLimiter: a per-IP token bucket that answers 429 instead of melting
 */

const inflight = new Map<string, Promise<unknown>>();

/** Concurrent callers with the same key await one promise; the work runs once. */
export function coalesce<T>(key: string, work: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = work().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * How long a certificate stays fresh. A 10-minute-old token can change grade
 * in a minute; a week-old one is frozen at its 7d checkpoint.
 */
export function certTtlMs(ageSec: number): number {
  if (ageSec < 3_600) return 60_000; // under an hour: re-grade every minute
  if (ageSec < 86_400) return 5 * 60_000; // first day: every five
  if (ageSec < 604_800) return 15 * 60_000; // first week: every fifteen
  return 60 * 60_000; // past 7d the retention grade is frozen
}

export class TtlCache<T> {
  private map = new Map<string, { at: number; ttlMs: number; value: T }>();
  constructor(private maxEntries = 500) {}

  get(key: string): T | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > hit.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.map.set(key, { at: Date.now(), ttlMs, value });
    if (this.map.size > this.maxEntries) {
      for (const [k] of [...this.map.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, Math.floor(this.maxEntries / 2))) {
        this.map.delete(k);
      }
    }
  }
}

/** Token bucket per key (an IP): `limit` requests per `windowMs`, refilled continuously. */
export class RateLimiter {
  private buckets = new Map<string, { tokens: number; at: number }>();
  constructor(private limit: number, private windowMs: number) {}

  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.limit, at: now };
    bucket.tokens = Math.min(this.limit, bucket.tokens + ((now - bucket.at) / this.windowMs) * this.limit);
    bucket.at = now;
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 5_000) {
      for (const [k, b] of this.buckets) if (now - b.at > this.windowMs * 2) this.buckets.delete(k);
    }
    return true;
  }
}

/** The client IP as Vercel forwards it; "anon" only when nothing is forwarded. */
export const clientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
