function readPositiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getClientKey(req, prefix) {
  const userKey = req.user?.id ? `user:${req.user.id}` : '';
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipKey = forwardedFor || req.ip || req.socket?.remoteAddress || 'unknown';
  return `${prefix}:${userKey || `ip:${ipKey}`}`;
}

function createRateLimit({
  windowMs = 60_000,
  max = 60,
  keyPrefix = 'default',
  message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
} = {}) {
  const buckets = new Map();

  return (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 10_000 || Math.random() < 0.01) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    const key = getClientKey(req, keyPrefix);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count <= max) return next();

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: message,
      retry_after: retryAfterSeconds,
    });
  };
}

const defaultRateLimit = createRateLimit({
  windowMs: readPositiveIntegerEnv('RATE_LIMIT_WINDOW_MS', 60_000),
  max: readPositiveIntegerEnv('RATE_LIMIT_MAX', 120),
  keyPrefix: 'api',
});

const aiRateLimit = createRateLimit({
  windowMs: readPositiveIntegerEnv('AI_RATE_LIMIT_WINDOW_MS', 60_000),
  max: readPositiveIntegerEnv('AI_RATE_LIMIT_MAX', 20),
  keyPrefix: 'ai',
  message: 'Bạn đang gọi AI quá nhanh. Vui lòng thử lại sau ít phút.',
});

const uploadRateLimit = createRateLimit({
  windowMs: readPositiveIntegerEnv('UPLOAD_RATE_LIMIT_WINDOW_MS', 60_000),
  max: readPositiveIntegerEnv('UPLOAD_RATE_LIMIT_MAX', 10),
  keyPrefix: 'upload',
  message: 'Bạn upload file quá nhanh. Vui lòng thử lại sau ít phút.',
});

module.exports = {
  aiRateLimit,
  createRateLimit,
  defaultRateLimit,
  uploadRateLimit,
};
