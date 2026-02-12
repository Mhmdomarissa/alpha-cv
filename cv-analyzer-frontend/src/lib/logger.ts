type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS = {
  ERROR: 'error' as const,
  WARN: 'warn' as const,
  INFO: 'info' as const,
  DEBUG: 'debug' as const,
};

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'access_token', 'refresh_token', 'otp', 'secret', 'api_key', 'authorization', 'username', 'email'];
    const sanitized = { ...data };

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        sanitized[key] = '***REDACTED***';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  private log(level: LogLevel, message: string, data?: any, requestId?: string) {
    // Only log in development mode
    if (!this.isDevelopment && level !== 'error') {
      return requestId || this.generateRequestId();
    }

    const timestamp = new Date().toISOString();
    const id = requestId || this.generateRequestId();
    
    // Sanitize sensitive data
    const sanitizedData = data ? this.sanitizeData(data) : undefined;
    
    const logEntry = {
      timestamp,
      level,
      message,
      requestId: id,
      ...(sanitizedData && { data: sanitizedData })
    };

    const consoleFn = console[level] || console.log;
    consoleFn(`[${timestamp}] [${level.toUpperCase()}] [${id}] ${message}`, sanitizedData || '');
    
    return id;
  }

  error(message: string, data?: any, requestId?: string) {
    return this.log(LOG_LEVELS.ERROR, message, data, requestId);
  }

  warn(message: string, data?: any, requestId?: string) {
    return this.log(LOG_LEVELS.WARN, message, data, requestId);
  }

  info(message: string, data?: any, requestId?: string) {
    return this.log(LOG_LEVELS.INFO, message, data, requestId);
  }

  debug(message: string, data?: any, requestId?: string) {
    return this.log(LOG_LEVELS.DEBUG, message, data, requestId);
  }
}

export const logger = new Logger();
export default logger;
