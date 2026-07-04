// In-memory IP rate limiter for /api/pf/initiate: 5 requests per 10 minutes.
// Fine for v1 on a single instance; on Vercel each serverless instance keeps
// its own counters, so the effective limit is per-instance (README caveat).

const WINDOW_MS = 10 * 60 * 1000;
// Overridable so test suites (single-IP) don't trip the limit.
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_INITIATES ?? '5');

const globalStore = globalThis as unknown as {
  __pfRateLimit?: Map<string, number[]>;
};
const hits: Map<string, number[]> =
  globalStore.__pfRateLimit ?? (globalStore.__pfRateLimit = new Map());

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return false;
  }
  recent.push(now);
  hits.set(ip, recent);

  // Opportunistic sweep so the map doesn't grow unbounded.
  if (hits.size > 10_000) {
    for (const [key, times] of hits) {
      if (times.every((t) => t <= windowStart)) hits.delete(key);
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
