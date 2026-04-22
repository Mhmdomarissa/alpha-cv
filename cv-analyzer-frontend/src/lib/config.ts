export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'CV Analyzer',
  appVersion: '2.0.0',
  requestTimeout: 600000,
  authTimeout: 10000,
} as const;

/**
 * Returns the base URL for API calls.
 * In the browser, always uses window.location.origin so requests go to the
 * same host:port the user opened the app on. Next.js rewrites (next.config.ts)
 * forward /api/* to the real backend, so this works whether the app is opened
 * via nginx (port 80) or directly on the dev port (3000).
 * On the server side (SSR/build) falls back to the configured apiUrl.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return config.apiUrl;
}
