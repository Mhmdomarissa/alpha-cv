/**
 * Configuration management following best practices
 * Centralized configuration with proper validation and environment handling
 */

interface Config {
  api: {
    baseUrl: string;
    internalUrl: string;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  app: {
    name: string;
    version: string;
    environment: 'development' | 'staging' | 'production' | 'test';
  };
  features: {
    debugPanel: boolean;
    mockMode: boolean;
    enableRetry: boolean;
    enableAnalytics: boolean;
  };
  upload: {
    maxFileSize: number;
    maxFiles: number;
    allowedTypes: string[];
    chunkSize: number;
  };
}

/**
 * Validates and returns application configuration
 */
function createConfig(): Config {
  // Get environment variables with validation
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production' | 'test';
  
  // Determine the correct backend URL based on environment
  let backendUrl: string;
  let internalUrl: string;

  if (apiUrl) {
    backendUrl = apiUrl;
    internalUrl = apiUrl;
  } else {
    // Fallback URLs based on environment
    switch (nodeEnv) {
      case 'production':
        backendUrl = 'https://api.cv-analyzer.com'; // Replace with your production URL
        internalUrl = 'http://backend:8000'; // Internal docker network
        break;
      case 'staging':
        backendUrl = 'https://staging-api.cv-analyzer.com'; // Replace with staging URL
        internalUrl = 'http://staging-backend:8000';
        break;
      case 'test':
        backendUrl = 'http://localhost:8000'; // Test environment
        internalUrl = 'http://localhost:8000';
        break;
      default: // development
        backendUrl = 'http://localhost:8000';
        internalUrl = 'http://backend:8000';
    }
    
    console.warn(`⚠️ NEXT_PUBLIC_API_URL not set, using fallback: ${backendUrl}`);
  }

  return {
    api: {
      baseUrl: backendUrl,
      internalUrl: internalUrl,
      timeout: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.NEXT_PUBLIC_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.NEXT_PUBLIC_RETRY_DELAY || '1000'),
    },
    app: {
      name: process.env.NEXT_PUBLIC_APP_NAME || 'CV Analyzer',
      version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      environment: nodeEnv as 'development' | 'staging' | 'production' | 'test',
    },
    features: {
      debugPanel: process.env.NEXT_PUBLIC_DEBUG_PANEL === 'true' || nodeEnv === 'development',
      mockMode: process.env.NEXT_PUBLIC_MOCK_MODE === 'true',
      enableRetry: process.env.NEXT_PUBLIC_ENABLE_RETRY !== 'false',
      enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true' && nodeEnv === 'production',
    },
    upload: {
      maxFileSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.NEXT_PUBLIC_MAX_FILES || '10'),
      allowedTypes: (process.env.NEXT_PUBLIC_ALLOWED_TYPES || 'pdf,docx,doc,txt,png,jpg,jpeg,tiff,bmp').split(','),
      chunkSize: parseInt(process.env.NEXT_PUBLIC_CHUNK_SIZE || '1048576'), // 1MB
    },
  };
}

export const config = createConfig();

// Helper functions
export const isDevelopment = config.app.environment === 'development';
export const isStaging = config.app.environment === 'staging';
export const isProduction = config.app.environment === 'production';

/**
 * Get API base URL for different contexts
 * @param context - 'client' for browser requests, 'server' for server-side requests
 */
export const getApiBaseUrl = (context: 'client' | 'server' = 'client'): string => {
  if (context === 'server' || typeof window === 'undefined') {
    // Server-side requests use the internal URL for better performance
    return config.api.internalUrl;
  }
  
  // Client-side requests
  if (isDevelopment) {
    // In development, make direct requests to backend
    return config.api.baseUrl;
  }
  
  // In production, use relative URLs to avoid CORS issues
  return '';
};

/**
 * Validate configuration on startup
 */
export const validateConfig = (): void => {
  const errors: string[] = [];
  
  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  }
  
  if (config.api.timeout < 1000) {
    errors.push('API timeout must be at least 1000ms');
  }
  
  if (config.upload.maxFileSize < 1024) {
    errors.push('Max file size must be at least 1KB');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:', errors);
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
  
  console.log('✅ Configuration validated successfully');
};

// Validate on import
if (typeof window === 'undefined') {
  validateConfig();
}