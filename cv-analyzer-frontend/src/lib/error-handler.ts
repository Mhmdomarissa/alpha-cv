/**
 * Centralized error handling following best practices
 */

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export class ApiErrorHandler {
  /**
   * Standardizes API error responses
   */
  static handleApiError(error: unknown): ApiError {
    // Network error
    if (!error.response) {
      return {
        message: 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
        details: error.message,
      };
    }

    const { status, data } = error.response;

    // Server errors
    if (status >= 500) {
      return {
        message: 'Server error. Please try again later.',
        status,
        code: 'SERVER_ERROR',
        details: data,
      };
    }

    // Client errors
    if (status >= 400) {
      return {
        message: data?.message || data?.detail || 'Request failed',
        status,
        code: 'CLIENT_ERROR',
        details: data,
      };
    }

    // Fallback
    return {
      message: 'An unexpected error occurred',
      status,
      code: 'UNKNOWN_ERROR',
      details: data,
    };
  }

  /**
   * Logs errors with proper formatting
   */
  static logError(error: ApiError, context?: string) {
    const logData = {
      context,
      ...error,
      timestamp: new Date().toISOString(),
    };

    console.error(`🚨 API Error${context ? ` [${context}]` : ''}:`, logData);
  }
}

/**
 * Retry logic for failed requests with enhanced configuration
 */
export class RequestRetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      exponentialBackoff?: boolean;
      retryCondition?: (error: unknown) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay: initialDelay = 1000,
      exponentialBackoff = true,
      retryCondition = (error) => {
        // Default: retry on network errors and 5xx server errors
        return !error.response || (error.response.status >= 500);
      }
    } = options;

    let lastError: unknown;
    let currentDelay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: unknown) {
        lastError = error;
        
        if (attempt === maxRetries || !retryCondition(error)) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStatus = (error as Record<string, unknown>)?.response?.status;
        console.warn(
          `⚠️ Request failed (attempt ${attempt}/${maxRetries}), retrying in ${currentDelay}ms...`,
          { error: errorMessage, status: errorStatus }
        );
        
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        if (exponentialBackoff) {
          currentDelay *= 2;
        }
      }
    }

    throw lastError;
  }
}

// Re-export logger from the main logging module
export { logger as Logger } from './logger';