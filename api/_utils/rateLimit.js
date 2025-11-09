// Simple in-memory limiter per IP per minute (OK for low traffic / demo).
// For production, use Upstash Redis Ratelimit or Vercel KV.
const buckets = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 30;

export function rateLimit(req) {
  try {
    const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString();
    const now = Date.now();
    const key = `${ip}:${Math.floor(now / WINDOW_MS)}`;
    const count = (buckets.get(key) || 0) + 1;
    buckets.set(key, count);
    setTimeout(() => buckets.delete(key), WINDOW_MS + 1000);
    if (count > LIMIT) return { ok: false, remaining: 0 };
    return { ok: true, remaining: LIMIT - count };
  } catch {
    return { ok: true, remaining: LIMIT }; // fail open
  }
}

