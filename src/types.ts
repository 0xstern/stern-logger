/**
 * @fileoverview TypeScript type definitions and interfaces
 *
 * Defines core types for Logger, configuration options, telemetry integration,
 * service metadata, file rotation, and OpenTelemetry span context.
 */

import type { Logger as PinoLogger } from 'pino';

/**
 * Enhanced logger extending Pino's logger with additional functionality
 */
export interface Logger extends PinoLogger {
  /**
   * Set the current trace context for correlation
   * @param context - The trace context to set
   */
  setTraceContext(context: SpanContext): void;

  /**
   * Get the current trace context
   * @returns The current trace context, or undefined if not set
   */
  getTraceContext(): SpanContext | undefined;

  /**
   * Clear the current trace context
   */
  clearTraceContext(): void;
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
   * @default 'debug' in development, 'info' in production
   */
  level?: string;

  /**
   * Default service name for logs
   * @default 'app'
   */
  defaultService?: string;

  /**
   * Current node environment (development, production, etc.)
   * @default 'development'
   */
  nodeEnv?: string;

  /**
   * Directory to store log files
   * @default undefined (file logging disabled)
   */
  logDir?: string;

  /**
   * Configuration for log file rotation
   * Only used when logDir is specified
   * @default undefined (no rotation)
   */
  fileRotationOptions?: FileRotationOptions;

  /**
   * Telemetry integration options
   * Configuration for connecting logs to telemetry systems
   * @default undefined (telemetry disabled)
   */
  telemetry?: TelemetryOptions;

  /**
   * Paths to redact from logs (e.g., 'password', 'creditCard')
   * Merged with default paths: password, token, apiKey, secret, ssn, etc.
   * @default ['password', 'creditCard', 'auth', 'authorization', 'cookie', 'token', 'apiKey', 'secret', 'ssn']
   */
  redactPaths?: ReadonlyArray<string>;

  /**
   * Whether to use pretty printing (development mode)
   * @default true in development, false in production
   */
  prettyPrint?: boolean;

  /**
   * Format style for pretty printing
   * - 'compact': HH:MM:SS LEVEL [env] [service] message {extra}
   * - 'default': Standard pino-pretty format with timestamp and indented fields
   * @default 'compact'
   */
  formatStyle?: 'compact' | 'default';

  /**
   * Enable strict validation of log messages and metadata
   * When false, skips validation for better performance
   * Disabling validation improves throughput by approximately 10-15%
   * but removes safeguards against oversized messages and invalid metadata
   * @default true
   */
  strict?: boolean;
}

/**
 * Options for file rotation
 */
export interface FileRotationOptions {
  /**
   * Maximum size of log files before rotation
   * E.g., '10m' for 10 megabytes, '100k' for 100 kilobytes
   * @default '10m'
   */
  maxSize?: string;

  /**
   * Maximum number of log files to keep
   * Older files are automatically deleted when limit is reached
   * @default 14
   */
  maxFiles?: number;

  /**
   * Frequency of rotation
   * @default 'daily'
   */
  frequency?: 'daily' | 'hourly';
}

/**
 * Telemetry integration options
 */
export interface TelemetryOptions {
  /**
   * Whether telemetry integration is enabled
   * @default false
   */
  enabled?: boolean;

  /**
   * Automatically inject trace context from OpenTelemetry's active span
   * When true, uses @opentelemetry/api to get the current active span context
   * @default false
   */
  autoInject?: boolean;

  /**
   * Options for how trace context is managed
   * @default undefined
   */
  contextOptions?: TelemetryContextOptions;
}

/**
 * Options for how telemetry context is managed
 */
export interface TelemetryContextOptions {
  /**
   * How to correlate logs with traces
   * - 'manual': Developer explicitly sets context via setTraceContext()
   * - 'auto': System tries to detect active spans automatically
   * @default 'manual'
   */
  correlationMode?: 'manual' | 'auto';

  /**
   * Whether to inject trace context into all logs
   * @default true
   */
  injectTraceContext?: boolean;

  /**
   * Function to get the active trace context
   * Used when correlationMode is 'auto'
   * @default undefined
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
