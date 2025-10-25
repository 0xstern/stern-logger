/**
 * @fileoverview Browser-compatible logger implementation
 *
 * Lightweight structured logging for browser environments with:
 * - Console output (development)
 * - Remote endpoint batching (production)
 * - LocalStorage buffering (offline support)
 * - Sentry integration (error tracking)
 * - Type-safe API matching Node version
 */

/* eslint-disable n/no-unsupported-features/node-builtins */

import type { SpanContext } from '../types';

/**
 * Browser log levels
 */
export type BrowserLogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal';

/**
 * Browser logger configuration
 */
export interface BrowserLoggerOptions {
  /**
   * Minimum log level to output
   * @default 'info'
   */
  level?: BrowserLogLevel;

  /**
   * Service name for logs
   * @default 'browser-app'
   */
  service?: string;

  /**
   * Enable console output (for development)
   * @default true
   */
  console?: boolean;

  /**
   * Remote endpoint configuration for production logging
   */
  remote?: {
    /**
     * Remote logging endpoint URL
     * @example 'https://api.example.com/logs'
     * @example 'http://localhost:3100/loki/api/v1/push'
     */
    url: string;

    /**
     * Authentication headers
     */
    headers?: Record<string, string>;

    /**
     * Batch configuration
     */
    batch?: {
      /**
       * Maximum batch size (number of logs)
       * @default 50
       */
      size?: number;

      /**
       * Maximum time to wait before sending batch (ms)
       * @default 5000
       */
      interval?: number;
    };

    /**
     * Enable LocalStorage buffering for offline support
     * @default true
     */
    enableOfflineBuffer?: boolean;
  };

  /**
   * Sentry DSN for error tracking
   * @example 'https://examplePublicKey@o0.ingest.sentry.io/0'
   */
  sentryDsn?: string;

  /**
   * Additional context to include in all logs
   */
  context?: Record<string, unknown>;

  /**
   * Fields to redact from logs
   * @default ['password', 'token', 'apiKey', 'secret']
   */
  redactPaths?: ReadonlyArray<string>;
}

/**
 * Log entry structure
 */
interface BrowserLogEntry {
  timestamp: number;
  level: BrowserLogLevel;
  message: string;
  service: string;
  context?: Record<string, unknown>;
  trace_id?: string;
  span_id?: string;
  trace_flags?: string;
  url?: string;
  userAgent?: string;
}

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_BATCH_INTERVAL_MS = 5000;
const DEFAULT_REDACT_PATHS = ['password', 'token', 'apiKey', 'secret'];
const MAX_OFFLINE_BUFFER_SIZE = 100;
const OFFLINE_BUFFER_KEY = '__logger_offline_buffer';

const LOG_LEVELS: Record<BrowserLogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Redacts sensitive fields from an object
 * @param obj - Object to redact
 * @param paths - Field paths to redact
 * @returns Redacted object
 */
function redactObject(
  obj: Record<string, unknown>,
  paths: ReadonlyArray<string>,
): Record<string, unknown> {
  const redacted = { ...obj };

  for (const path of paths) {
    if (path in redacted) {
      redacted[path] = '[REDACTED]';
    }

    // Handle nested paths (simple dot notation)
    if (path.includes('.')) {
      const parts = path.split('.');
      const firstPart = parts[0];
      if (
        firstPart != null &&
        typeof redacted[firstPart] === 'object' &&
        redacted[firstPart] !== null
      ) {
        const remaining = parts.slice(1).join('.');
        redacted[firstPart] = redactObject(
          redacted[firstPart] as Record<string, unknown>,
          [remaining],
        );
      }
    }
  }

  return redacted;
}

/**
 * Browser logger implementation
 */
export class BrowserLogger {
  private readonly options: Required<
    Omit<BrowserLoggerOptions, 'remote' | 'sentryDsn'>
  > & {
    remote?: BrowserLoggerOptions['remote'];
    sentryDsn?: string;
  };

  private readonly batchBuffer: Array<BrowserLogEntry> = [];
  private batchTimer?: ReturnType<typeof setInterval>;
  private traceContext?: SpanContext;
  private sentryInitialized = false;

  constructor(options: BrowserLoggerOptions = {}) {
    this.options = {
      level: options.level ?? 'info',
      service: options.service ?? 'browser-app',
      console: options.console ?? true,
      context: options.context ?? {},
      redactPaths: options.redactPaths ?? DEFAULT_REDACT_PATHS,
      remote: options.remote,
      sentryDsn: options.sentryDsn,
    };

    // Initialize Sentry if DSN provided
    if (this.options.sentryDsn != null) {
      this.initializeSentry();
    }

    // Start batch timer if remote logging enabled
    if (this.options.remote != null) {
      this.startBatchTimer();

      // Load offline buffer on initialization
      this.loadOfflineBuffer();

      // Send buffered logs on page unload
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          void this.flush();
        });
      }
    }
  }

  /**
   * Set trace context for correlation with distributed traces
   * @param context - OpenTelemetry span context
   */
  public setTraceContext(context: SpanContext): void {
    this.traceContext = context;
  }

  /**
   * Get current trace context
   * @returns Current trace context or undefined
   */
  public getTraceContext(): SpanContext | undefined {
    return this.traceContext;
  }

  /**
   * Clear trace context
   */
  public clearTraceContext(): void {
    this.traceContext = undefined;
  }

  /**
   * Create a child logger with additional context
   * @param childContext - Additional context for child logger
   * @returns New logger instance with merged context
   */
  public child(childContext: Record<string, unknown>): BrowserLogger {
    return new BrowserLogger({
      ...this.options,
      context: {
        ...this.options.context,
        ...childContext,
      },
    });
  }

  /**
   * Log trace level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public trace(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('trace', contextOrMessage, message);
  }

  /**
   * Log debug level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public debug(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('debug', contextOrMessage, message);
  }

  /**
   * Log info level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public info(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('info', contextOrMessage, message);
  }

  /**
   * Log warn level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public warn(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('warn', contextOrMessage, message);
  }

  /**
   * Log error level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public error(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('error', contextOrMessage, message);
  }

  /**
   * Log fatal level message
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  public fatal(
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    this.log('fatal', contextOrMessage, message);
  }

  /**
   * Flush pending logs immediately
   */
  public async flush(): Promise<void> {
    if (this.batchBuffer.length > 0) {
      await this.sendBatch();
    }
  }

  /**
   * Core logging method
   * @param level - Log level
   * @param contextOrMessage - Context object or message string
   * @param message - Message string (if first arg is context)
   */
  private log(
    level: BrowserLogLevel,
    contextOrMessage: Record<string, unknown> | string,
    message?: string,
  ): void {
    // Check if level is enabled
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.level]) {
      return;
    }

    // Parse arguments
    const isContextFirst = typeof contextOrMessage === 'object';
    const logMessage = isContextFirst
      ? (message ?? 'Log message')
      : contextOrMessage;
    const contextData = isContextFirst
      ? (contextOrMessage as Record<string, unknown>)
      : {};

    // Build log entry
    const entry: BrowserLogEntry = {
      timestamp: Date.now(),
      level,
      message: logMessage,
      service: this.options.service,
      context: redactObject(
        {
          ...this.options.context,
          ...contextData,
        },
        this.options.redactPaths,
      ),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Add trace context if available
    if (this.traceContext != null) {
      entry.trace_id = this.traceContext.traceId;
      entry.span_id = this.traceContext.spanId;
      entry.trace_flags = this.traceContext.traceFlags;
    }

    // Console output
    if (this.options.console) {
      this.writeToConsole(entry);
    }

    // Remote logging
    if (this.options.remote != null) {
      this.addToBatch(entry);
    }

    // Send to Sentry if error level
    this.maybeSendToSentry(level, entry);
  }

  /**
   * Send error to Sentry if conditions are met
   * @param level - Log level
   * @param entry - Log entry
   */
  private maybeSendToSentry(
    level: BrowserLogLevel,
    entry: BrowserLogEntry,
  ): void {
    if (
      (level === 'error' || level === 'fatal') &&
      this.sentryInitialized &&
      typeof window !== 'undefined' &&
      'Sentry' in window
    ) {
      this.sendToSentry(entry);
    }
  }

  /**
   * Write log entry to console
   * @param entry - Log entry to write
   */
  private writeToConsole(entry: BrowserLogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
    const context = entry.context != null ? JSON.stringify(entry.context) : '';

    const fullMessage =
      context.length > 0
        ? `${prefix} ${entry.message} ${context}`
        : `${prefix} ${entry.message}`;

    // Map to console methods
    switch (entry.level) {
      case 'trace':
      case 'debug':
        console.debug(fullMessage);
        break;
      case 'info':
        console.info(fullMessage);
        break;
      case 'warn':
        console.warn(fullMessage);
        break;
      case 'error':
      case 'fatal':
        console.error(fullMessage);
        break;
    }
  }

  /**
   * Add log entry to batch buffer
   * @param entry - Log entry to buffer
   */
  private addToBatch(entry: BrowserLogEntry): void {
    this.batchBuffer.push(entry);

    const batchSize = this.options.remote?.batch?.size ?? DEFAULT_BATCH_SIZE;

    // Send immediately if batch full
    if (this.batchBuffer.length >= batchSize) {
      void this.sendBatch();
    }
  }

  /**
   * Send batch of logs to remote endpoint
   */
  private async sendBatch(): Promise<void> {
    if (this.batchBuffer.length === 0 || this.options.remote == null) {
      return;
    }

    const logs = [...this.batchBuffer];
    this.batchBuffer.length = 0; // Clear buffer

    try {
      const response = await fetch(this.options.remote.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.remote.headers,
        },
        body: JSON.stringify({ logs }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Store in offline buffer if enabled
      if (this.options.remote.enableOfflineBuffer !== false) {
        this.saveToOfflineBuffer(logs);
      }

      // Log error to console
      if (this.options.console) {
        console.error('Failed to send logs to remote endpoint:', error);
      }
    }
  }

  /**
   * Start batch timer for periodic sends
   */
  private startBatchTimer(): void {
    const interval =
      this.options.remote?.batch?.interval ?? DEFAULT_BATCH_INTERVAL_MS;

    this.batchTimer = setInterval(() => {
      void this.sendBatch();
    }, interval);
  }

  /**
   * Save logs to LocalStorage for offline support
   * @param logs - Logs to save
   */
  private saveToOfflineBuffer(logs: Array<BrowserLogEntry>): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const existing = localStorage.getItem(OFFLINE_BUFFER_KEY);
      const buffer: Array<BrowserLogEntry> =
        existing != null
          ? (JSON.parse(existing) as Array<BrowserLogEntry>)
          : [];

      // Add new logs and limit buffer size
      buffer.push(...logs);
      const trimmed = buffer.slice(-MAX_OFFLINE_BUFFER_SIZE);

      localStorage.setItem(OFFLINE_BUFFER_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore localStorage errors (quota exceeded, etc.)
    }
  }

  /**
   * Load offline buffer and attempt to send
   */
  private loadOfflineBuffer(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const existing = localStorage.getItem(OFFLINE_BUFFER_KEY);
      if (existing == null) {
        return;
      }

      const buffer: Array<BrowserLogEntry> = JSON.parse(
        existing,
      ) as Array<BrowserLogEntry>;
      if (buffer.length > 0) {
        // Add to batch buffer
        this.batchBuffer.push(...buffer);

        // Clear offline buffer
        localStorage.removeItem(OFFLINE_BUFFER_KEY);

        // Attempt to send
        void this.sendBatch();
      }
    } catch {
      // Ignore errors
    }
  }

  /**
   * Initialize Sentry SDK
   */
  private initializeSentry(): void {
    if (
      typeof window === 'undefined' ||
      !('Sentry' in window) ||
      this.options.sentryDsn == null
    ) {
      return;
    }

    try {
      const Sentry = (
        window as { Sentry?: { init: (options: unknown) => void } }
      ).Sentry;
      if (Sentry != null) {
        const env = this.options.context.env;
        Sentry.init({
          dsn: this.options.sentryDsn,
          environment: typeof env === 'string' ? env : 'production',
          // Additional Sentry configuration can be added here
        });
        this.sentryInitialized = true;
      }
    } catch {
      // Sentry initialization failed, continue without it
    }
  }

  /**
   * Send error to Sentry
   * @param entry - Log entry containing error
   */
  private sendToSentry(entry: BrowserLogEntry): void {
    if (typeof window === 'undefined' || !('Sentry' in window)) {
      return;
    }

    try {
      const Sentry = (
        window as {
          Sentry?: {
            captureMessage: (message: string, context: unknown) => void;
            captureException: (error: unknown, context: unknown) => void;
          };
        }
      ).Sentry;

      if (Sentry == null) {
        return;
      }

      const sentryContext = {
        level: entry.level,
        extra: entry.context,
        tags: {
          service: entry.service,
          trace_id: entry.trace_id,
          span_id: entry.span_id,
        },
      };

      // Check if context has an error object
      if (
        entry.context != null &&
        'err' in entry.context &&
        entry.context.err instanceof Error
      ) {
        Sentry.captureException(entry.context.err, sentryContext);
      } else {
        Sentry.captureMessage(entry.message, sentryContext);
      }
    } catch {
      // Ignore Sentry errors
    }
  }

  /**
   * Destroy logger and cleanup resources
   */
  public destroy(): void {
    if (this.batchTimer != null) {
      clearInterval(this.batchTimer);
    }

    void this.flush();
  }
}

/**
 * Initialize browser logger with configuration
 * @param options - Browser logger options
 * @returns Configured browser logger instance
 *
 * @example Development usage (console only)
 * ```typescript
 * import { initBrowserLogger } from '@mrstern/logger/browser';
 *
 * const logger = initBrowserLogger({
 *   level: 'debug',
 *   service: 'my-app',
 *   console: true,
 * });
 *
 * logger.info('App initialized');
 * logger.error({ err }, 'Request failed');
 * ```
 *
 * @example Production usage (remote + Sentry)
 * ```typescript
 * const logger = initBrowserLogger({
 *   level: 'info',
 *   service: 'my-app',
 *   console: false,
 *   remote: {
 *     url: 'https://api.example.com/logs',
 *     headers: {
 *       'Authorization': 'Bearer token',
 *     },
 *     batch: {
 *       size: 50,
 *       interval: 5000,
 *     },
 *   },
 *   sentryDsn: 'https://key@sentry.io/project',
 *   context: {
 *     env: 'production',
 *     version: '1.0.0',
 *   },
 * });
 * ```
 */
export function initBrowserLogger(
  options?: BrowserLoggerOptions,
): BrowserLogger {
  return new BrowserLogger(options);
}

/**
 * Pre-initialized browser logger with defaults
 */
export const baseBrowserLogger = new BrowserLogger();
