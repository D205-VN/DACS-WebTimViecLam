const memoryCache = new Map();
const inflightRequests = new Map();
const DEFAULT_TTL_MS = 30 * 1000;

function getCacheKey(url, options = {}) {
  const method = options.method || 'GET';
  const auth = options.headers?.Authorization || '';
  return `${method}:${url}:${auth}`;
}

export function clearRequestCache(predicate) {
  if (!predicate) {
    memoryCache.clear();
    return;
  }

  for (const [key, entry] of memoryCache.entries()) {
    if (predicate(key, entry)) memoryCache.delete(key);
  }
}

export function clearRequestCacheByUrl(partialUrl) {
  clearRequestCache((key) => key.includes(partialUrl));
}

export function readCachedJson(url, options = {}) {
  const key = getCacheKey(url, options);
  const entry = memoryCache.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export async function cachedJsonFetch(url, options = {}, config = {}) {
  const method = options.method || 'GET';
  const ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
  const cacheKey = getCacheKey(url, options);

  if (method === 'GET' && !config.force) {
    const cached = readCachedJson(url, options);
    if (cached !== null) return cached;

    if (inflightRequests.has(cacheKey)) {
      return inflightRequests.get(cacheKey);
    }
  }

  const request = fetch(url, options)
    .then(async (response) => {
      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
      }

      if (method === 'GET' && ttlMs > 0) {
        memoryCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttlMs,
        });
      }

      return data;
    })
    .finally(() => {
      inflightRequests.delete(cacheKey);
    });

  if (method === 'GET') inflightRequests.set(cacheKey, request);
  return request;
}
