export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000', // Use 127.0.0.1 for Windows compatibility
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'CV Analyzer',
  appVersion: '2.0.0',
  requestTimeout: 600000, // 10 minutes for large batch matching (increased to prevent browser timeouts)
  authTimeout: 10000, // 10 seconds for auth requests
} as const;

export const getApiBaseUrl = () => config.apiUrl;
