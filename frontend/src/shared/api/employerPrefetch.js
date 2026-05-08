import API_BASE_URL from '@shared/api/baseUrl';
import { cachedJsonFetch } from '@shared/api/requestCache';

const PREFETCH_TTL_MS = 45 * 1000;
const PREFETCH_COOLDOWN_MS = 45 * 1000;
const lastPrefetchByToken = new Map();

function scheduleIdleWork(callback) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: 2500 });
    return;
  }

  window.setTimeout(callback, 250);
}

export function prefetchEmployerPortalData(token) {
  if (!token || typeof window === 'undefined') return;

  const lastPrefetch = lastPrefetchByToken.get(token) || 0;
  if (Date.now() - lastPrefetch < PREFETCH_COOLDOWN_MS) return;
  lastPrefetchByToken.set(token, Date.now());

  const headers = { Authorization: `Bearer ${token}` };
  const endpoints = [
    `${API_BASE_URL}/api/employer/jobs`,
    `${API_BASE_URL}/api/employer/candidates`,
    `${API_BASE_URL}/api/employer/profile`,
    `${API_BASE_URL}/api/employer/analytics`,
    `${API_BASE_URL}/api/meeting-rooms`,
    `${API_BASE_URL}/api/ai-tests/tests`,
  ];

  scheduleIdleWork(() => {
    endpoints.forEach((url) => {
      cachedJsonFetch(url, { headers }, { ttlMs: PREFETCH_TTL_MS }).catch(() => {});
    });
  });
}
