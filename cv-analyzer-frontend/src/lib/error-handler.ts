import { logger } from './logger';

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
  requestId?: string;
}

export class ApiErrorHandler {
  static handle(error: any, requestId?: string): ApiError {
    const id = requestId || `err_${Date.now()}`;
    
    // Network errors
    if (!error.response) {
      logger.error('Network error', { error: error.message }, id);
      return {
        status: 0,
        message: 'Unable to connect to the server. Please check your connection.',
        detail: error.message,
        requestId: id,
      };
    }

    // HTTP errors with response
    const { status, data } = error.response;
    
    let message = 'An unexpected error occurred';
    let detail = '';

    switch (status) {
      case 400:
        message = 'Invalid request';
        detail = data?.detail || 'Please check your input and try again.';
        break;
      case 401:
        message = 'Authentication required';
        detail = 'Please log in to continue.';
        break;
      case 403:
        message = 'Access denied';
        detail = 'You do not have permission to perform this action.';
        break;
      case 404:
        message = 'Resource not found';
        detail = data?.detail || 'The requested resource could not be found.';
        break;
      case 422:
        message = 'Validation error';
        detail = data?.detail || 'Please check your input format.';
        break;
      case 500:
        message = 'Server error';
        detail = 'Something went wrong on our end. Please try again later.';
        break;
      case 503:
        message = 'Service unavailable';
        detail = 'The service is temporarily unavailable. Please try again later.';
        break;
      default:
        message = `HTTP ${status} Error`;
        detail = data?.detail || error.message;
    }

    logger.error(`API Error: ${status}`, { message, detail, data }, id);

    return {
      status,
      message,
      detail,
      requestId: id,
    };
  }
}

export class RequestRetryHandler {
  static async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response?.status >= 400 && axiosError.response?.status < 500) {
            throw error;
          }
        }

        if (attempt < maxRetries) {
          logger.warn(`Request failed, retrying (${attempt}/${maxRetries})`, { error });
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError;
  }
}
