/**
 * Comprehensive logging system for the CV Analyzer application
 * Supports different log levels, contexts, and structured logging
 */

import { config, isDevelopment, isProduction } from './config';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  data?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
}

interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  maxBufferSize: number;
  flushInterval: number;
}

class Logger {
  private config: LoggerConfig;
  private context: string = 'App';
  private buffer: LogEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.config = {
      level: isDevelopment ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableRemote: isProduction && config.features.enableAnalytics,
      remoteEndpoint: process.env.NEXT_PUBLIC_LOGGING_ENDPOINT,
      maxBufferSize: 100,
      flushInterval: 30000, // 30 seconds
    };

    // Setup periodic flushing in production
    if (this.config.enableRemote) {
      setInterval(() => this.flush(), this.config.flushInterval);
    }

    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(level: LogLevel, message: string, data?: Record<string, unknown>): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      data,
    };

    // Add browser context if available
    if (typeof window !== 'undefined') {
      entry.url = window.location.href;
      entry.userAgent = navigator.userAgent;
    }

    return entry;
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const levelEmoji = {
      [LogLevel.DEBUG]: '🐛',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.ERROR]: '❌',
      [LogLevel.FATAL]: '💀',
    };

    const prefix = `${levelEmoji[entry.level]} [${entry.context}]`;
    return `${prefix} ${entry.message}`;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const message = this.formatConsoleMessage(entry);
    const consoleMethod = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.info,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
      [LogLevel.FATAL]: console.error,
    }[entry.level];

    if (entry.data && Object.keys(entry.data).length > 0) {
      consoleMethod(message, entry.data);
    } else {
      consoleMethod(message);
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (!this.config.enableRemote || this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      if (this.config.remoteEndpoint) {
        await fetch(this.config.remoteEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logs: logsToSend }),
        });
      }
    } catch (error) {
      // Silent fail for logging errors to avoid infinite loops
      console.warn('Failed to send logs to remote endpoint:', error);
      // Put logs back in buffer for retry
      this.buffer.unshift(...logsToSend);
    }
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, data);
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  // Public API
  setContext(context: string): void {
    this.context = context;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: unknown): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    this.log(LogLevel.ERROR, message, errorData);
  }

  fatal(message: string, error?: unknown): void {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;
    this.log(LogLevel.FATAL, message, errorData);
  }

  // Performance logging
  time(label: string): void {
    if (isDevelopment) {
      console.time(`⏱️ [${this.context}] ${label}`);
    }
  }

  timeEnd(label: string): void {
    if (isDevelopment) {
      console.timeEnd(`⏱️ [${this.context}] ${label}`);
    }
  }

  // User action tracking
  trackUserAction(action: string, data?: Record<string, unknown>): void {
    this.info(`User action: ${action}`, { action, ...data });
  }

  // API call tracking
  trackApiCall(method: string, endpoint: string, duration: number, status: number): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `API ${method} ${endpoint}`, {
      method,
      endpoint,
      duration,
      status,
    });
  }

  // File operation tracking
  trackFileOperation(operation: string, filename: string, size?: number, duration?: number): void {
    this.info(`File operation: ${operation}`, {
      operation,
      filename,
      size,
      duration,
    });
  }
}

// Create singleton instance
export const logger = new Logger();

// Export convenience functions
export const setLogContext = (context: string) => logger.setContext(context);
export const logDebug = (message: string, data?: Record<string, unknown>) => logger.debug(message, data);
export const logInfo = (message: string, data?: Record<string, unknown>) => logger.info(message, data);
export const logWarn = (message: string, data?: Record<string, unknown>) => logger.warn(message, data);
export const logError = (message: string, error?: unknown) => logger.error(message, error);
export const logFatal = (message: string, error?: unknown) => logger.fatal(message, error);
export const trackUserAction = (action: string, data?: Record<string, unknown>) => logger.trackUserAction(action, data);
export const trackApiCall = (method: string, endpoint: string, duration: number, status: number) => 
  logger.trackApiCall(method, endpoint, duration, status);
export const trackFileOperation = (operation: string, filename: string, size?: number, duration?: number) => 
  logger.trackFileOperation(operation, filename, size, duration);

export default logger;