const WINDOW_MS = 60_000;
const buckets = new Map();

function clientAddress(req) {
  const forwarded = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'];
  return String(forwarded || 'unknown').split(',')[0].trim() || 'unknown';
}

/**
 * Best-effort warm-instance limiter. A distributed Vercel/WAF policy remains
 * the production boundary across serverless instances.
 */
export function rejectIfRateLimited(req, res, options = {}, subject = '') {
  const scope = String(options.scope || 'protected');
  const limit = Number.isFinite(options.limit) ? options.limit : 60;
  const key = `${scope}:${clientAddress(req)}:${String(subject || 'anonymous')}`;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return false;
  }
  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ detail: 'Rate limit exceeded. Try again later.' });
    return true;
  }

  current.count += 1;
  return false;
}

export function resetRateLimits() {
  buckets.clear();
}
