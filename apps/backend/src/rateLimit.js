export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 10, // 10 attempts per window
  message = "Too many login attempts, please try again later",
} = {}) {
  const hits = new Map();

  // Prune expired entries periodically to prevent memory leak
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60000);
  if (timer.unref) timer.unref();

  return (req, res, next) => {
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let record = hits.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + windowMs };
      hits.set(key, record);
    }

    record.count += 1;
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - record.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((record.resetTime - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    next();
  };
}
