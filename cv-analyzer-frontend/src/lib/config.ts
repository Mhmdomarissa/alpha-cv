export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || '',
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'CV Analyzer',
  appVersion: '2.0.0',
  requestTimeout: 30000,
} as const;

export const getApiBaseUrl = () => config.apiUrl;
