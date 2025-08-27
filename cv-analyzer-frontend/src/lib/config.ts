export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://13.62.91.25:8000',
  appVersion: '2.0.0',
  requestTimeout: 30000,
} as const;

export const getApiBaseUrl = () => config.apiUrl;
