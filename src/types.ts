import type { Logger as PinoLogger } from 'pino';

/**
 * Enhanced logger extending Pino's logger with additional functionality
 */
export interface Logger extends PinoLogger {
  /**
   * Set the current trace context for correlation
   * @param context - The trace context to set
   */
  setTraceContext?(context: SpanContext): void;

  /**
   * Clear the current trace context
   */
  clearTraceContext?(): void;
}

/**
 * Metadata for service identification and context
 */
export interface ServiceMetadata {
  /**
   * Top-level service name (e.g., api, worker, db-migrator)
   * Optional for child loggers - inherits from parent
   */
  service?: string;

  /**
   * Major component or business domain (e.g., merchant, user, payment-processor)
   */
  component?: string;

  /**
   * Specific operation or function (e.g., create, validate, connect, transform)
   */
  operation?: string;

  /**
   * Architecture layer (e.g., handler, service, repository, client, utility)
   */
  layer?: string;

  /**
   * Business domain for cross-cutting concerns (e.g., auth, billing, logistics)
   */
  domain?: string;

  /**
   * External system integration (e.g., stripe, aws-s3, postgres, redis)
   */
  integration?: string;

  /**
   * Optional span context for trace correlation
   * Enables connecting logs to distributed traces
   */
  spanContext?: SpanContext;

  /**
   * Any additional metadata to include with logs
   */
  [key: string]: unknown;
}

/**
 * Configuration options for the logger
 */
export interface LoggerOptions {
  /**
   * Log level (debug, info, warn, error, fatal)
   */
  level?: string;

  /**
   * Default service name for logs
   */
  defaultService?: string;

  /**
   * Current node environment (development, production, etc.)
   */
  nodeEnv?: string;

  /**
   * Directory to store log files
   */
  logDir?: string;

  /**
   * Configuration for log file rotation
   */
  fileRotationOptions?: FileRotationOptions;

  /**
   * Telemetry integration options
   * Configuration for connecting logs to telemetry systems
   */
  telemetry?: TelemetryOptions;

  /**
   * Paths to redact from logs (e.g., 'password', 'creditCard')
   */
  redactPaths?: ReadonlyArray<string>;

  /**
   * Whether to use pretty printing (development mode)
   */
  prettyPrint?: boolean;
}

/**
 * Options for file rotation
 */
export interface FileRotationOptions {
  /**
   * Maximum size of log files before rotation
   * E.g., '10m' for 10 megabytes
   */
  maxSize?: string;

  /**
   * Maximum number of log files to keep
   */
  maxFiles?: number;

  /**
   * Frequency of rotation (e.g., 'daily', 'hourly')
   */
  frequency?: 'daily' | 'hourly';
}

/**
 * Telemetry integration options
 */
export interface TelemetryOptions {
  /**
   * Whether telemetry integration is enabled
   */
  enabled?: boolean;

  /**
   * Options for how trace context is managed
   */
  contextOptions?: TelemetryContextOptions;
}

/**
 * Options for how telemetry context is managed
 */
export interface TelemetryContextOptions {
  /**
   * How to correlate logs with traces
   * 'manual': Developer explicitly sets context
   * 'auto': System tries to detect active spans
   */
  correlationMode?: 'manual' | 'auto';

  /**
   * Whether to inject trace context into all logs
   */
  injectTraceContext?: boolean;

  /**
   * Function to get the active trace context
   * Used when correlationMode is 'auto'
   */
  getActiveContext?: () => SpanContext | undefined;
}

/**
 * Standard OpenTelemetry span context
 */
export interface SpanContext {
  /**
   * Trace ID for correlating logs to traces
   */
  traceId: string;

  /**
   * Span ID for correlating logs to specific spans
   */
  spanId: string;

  /**
   * Trace flags as a hex string
   */
  traceFlags?: string;

  /**
   * Additional trace state information
   */
  traceState?: string;
}

/**
 * Log levels with their numeric severity values
 * Matches Pino's default levels
 */
export const SEVERITY_LEVELS = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
} as const;

export type SeverityLevel = keyof typeof SEVERITY_LEVELS;
