const buckets = new Map();

export function createRateLimiter({ windowMs = 60000, max = 60, keyPrefix = 'global' } = {}) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'local';
    const key = `${keyPrefix}:${ip}:${req.user?.id || 'anon'}`;
    const now = Date.now();
    const record = buckets.get(key);

    if (!record || now > record.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a moment before trying again.',
      });
    }

    record.count += 1;
    return next();
  };
}
