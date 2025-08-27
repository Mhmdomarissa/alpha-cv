type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS = {
  ERROR: 'error' as const,
  WARN: 'warn' as const,
  INFO: 'info' as const,
  DEBUG: 'debug' as const,
};

class Logger {
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: LogLevel, message: string, data?: any, requestId?: string) {
    const timestamp = new Date().toISOString();
    const id = requestId || this.generateRequestId();
    
    const logEntry = {
      timestamp,
      level,
      message,
      requestId: id,
      ...(data && { data })
    };

    const consoleFn = console[level] || console.log;
    consoleFn(`[${timestamp}] [${level.toUpperCase()}] [${id}] ${message}`, data || '');
    
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
