import axios from 'axios';
import API_BASE_URL from './config';

/**
 * Centralized axios instance with timeout and auto-retry.
 * Every page should import `api` from here instead of using raw axios.
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000, // 15s — fail fast instead of hanging forever
});

// Retry once on network errors or 502/503 (Render cold start)
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error.config;
    // Only retry GET requests, only once
    if (
      config &&
      !config._retried &&
      config.method === 'get' &&
      (!error.response || [502, 503].includes(error.response.status))
    ) {
      config._retried = true;
      // Wait 2s for Render to wake up, then retry
      await new Promise((r) => setTimeout(r, 2000));
      return api(config);
    }
    return Promise.reject(error);
  }
);

/**
 * Ping /health to wake up Render before loading real data.
 * Call this once when the app mounts or on login.
 * Returns true if backend is reachable, false otherwise.
 */
export async function warmup() {
  try {
    await api.get('/health', { timeout: 8000 });
    return true;
  } catch {
    return false;
  }
}

export default api;
