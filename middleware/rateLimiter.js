const rateLimiter = ({ windowMs = 15 * 60 * 1000, max = 100 } = {}) => {
  const store = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, windowMs);

  if (cleanup.unref) {
    cleanup.unref();
  }

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    let entry = store.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime: now + windowMs };
      store.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(0, max - entry.count);
    const resetTime = Math.ceil(entry.resetTime / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetTime);

    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests, please try again later",
      });
    }

    next();
  };
};

module.exports = rateLimiter;
