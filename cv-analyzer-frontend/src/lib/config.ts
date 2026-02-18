export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'CV Analyzer',
  appVersion: '2.0.0',
  requestTimeout: 600000,
  authTimeout: 10000,
} as const;

/** Use at request time so HTTPS pages use same origin (avoids mixed content). */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return window.location.origin;
  }
  return config.apiUrl;
}
