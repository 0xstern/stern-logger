/**
 * @fileoverview Core logger implementation and initialization
 *
 * Provides logger initialization, transport configuration (console/file),
 * OpenTelemetry trace context integration, and telemetry method enhancement.
 */

import type {
  Logger,
  LoggerOptions,
  ServiceMetadata,
  SpanContext,
} from './types';
import type { NamespaceConfig } from './utils/namespace_filter';

import { join } from 'node:path';

import { context, trace } from '@opentelemetry/api';
import pino from 'pino';

import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_NODE_ENV,
  DEFAULT_ROTATION_OPTIONS,
  DEFAULT_SERVICE_NAME,
} from './constants';
import { setupLogDirectory } from './utils/directory';
import { ConfigurationError, createSerializers } from './utils/error-handler';
import { createCustomPrettyOptions } from './utils/formatter';
import {
  buildNamespace,
  isNamespaceEnabled,
  parseNamespacePatterns,
} from './utils/namespace_filter';
import { createRedactionOptions } from './utils/redaction';
import {
  clearTraceContext,
  createTraceMixin,
  getTraceContext,
  setTraceContext,
} from './utils/telemetry';

/**
 * Detects if we're running in a Node.js or Bun environment
 * @returns True if running in Node.js/Bun environment
 */
function isNodeEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    typeof process.pid === 'number' &&
    typeof process.env === 'object'
  );
}

/**
 * Detects if we're running in a compiled/bundled executable
 * @returns True if running as a compiled executable
 */
function isCompiledExecutable(): boolean {
  // Check for Bun compiled executable
  if (typeof Bun !== 'undefined' && typeof Bun.main === 'string') {
    // In compiled executables, Bun.main doesn't end in .ts/.js
    // and typically contains 'bunfs' or doesn't have an extension
    return !Bun.main.endsWith('.ts') && !Bun.main.endsWith('.js');
  }

  // Check for other bundled environments
  // pkg (Node.js compiler) sets process.pkg
  if (
    typeof process !== 'undefined' &&
    typeof (process as { pkg?: unknown }).pkg !== 'undefined'
  ) {
    return true;
  }

  return false;
}

const RADIX_BASE_36 = 36;
const RANDOM_ID_START = 2;
const RANDOM_ID_END = 11;

// Hex conversion constants for trace flags
const HEX_RADIX = 16;
const TRACE_FLAGS_PAD_LENGTH = 2;

/**
 * Get a unique ID for the current process/thread
 * @returns Thread/process identifier string
 */
function getCurrentThreadId(): string {
  if (isNodeEnvironment()) {
    return process.pid.toString();
  }

  // Fallback for non-Node environments
  return `thread-${Math.random().toString(RADIX_BASE_36).slice(RANDOM_ID_START, RANDOM_ID_END)}`;
}

/**
 * Determine if pretty printing should be enabled
 * @param options - Logger options
 * @returns True if pretty printing should be enabled
 */
function shouldEnablePrettyPrint(options?: Partial<LoggerOptions>): boolean {
  // Disable pretty printing in compiled executables (pino-pretty can't be bundled)
  if (isCompiledExecutable()) {
    return false;
  }

  // Users can set prettyPrint: false explicitly for production
  return options?.prettyPrint ?? true;
}

/**
 * Helper to add console transport if needed
 * @param targets - Array to add transport configuration to
 * @param options - Logger options
 */
function addConsoleTransport(
  targets: Array<pino.TransportTargetOptions>,
  options?: Partial<LoggerOptions>,
): void {
  if (!shouldEnablePrettyPrint(options)) {
    return;
  }

  const formatStyle = options?.formatStyle ?? 'compact';
  const prettyOptions =
    formatStyle === 'compact'
      ? createCustomPrettyOptions(options?.compactMessageFields)
      : {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        };

  targets.push({
    target: 'pino-pretty',
    level: options?.level ?? DEFAULT_LOG_LEVEL,
    options: prettyOptions,
  });
}

/**
 * Helper to configure file rotation options
 * @param rotationOptions - File rotation configuration
 * @param logDir - Log directory path
 * @param level - Log level
 * @returns Transport target options for pino-roll
 */
function createRotationTransport(
  rotationOptions: Partial<{
    maxSize?: string;
    maxFiles?: number;
    frequency?: 'daily' | 'hourly';
  }>,
  logDir: string,
  level: string,
): pino.TransportTargetOptions {
  const maxSize = rotationOptions.maxSize ?? DEFAULT_ROTATION_OPTIONS.MAX_SIZE;
  const maxFiles =
    rotationOptions.maxFiles ?? DEFAULT_ROTATION_OPTIONS.MAX_FILES;
  const frequency =
    rotationOptions.frequency ?? DEFAULT_ROTATION_OPTIONS.FREQUENCY;

  return {
    target: 'pino-roll',
    level,
    options: {
      file: join(logDir, 'app.log'),
      frequency,
      size: maxSize,
      limit: {
        count: maxFiles,
      },
      mkdir: true,
    },
  };
}

/**
 * Helper to add file transport if needed
 * @param targets - Array to add transport configuration to
 * @param options - Logger options
 */
function addFileTransport(
  targets: Array<pino.TransportTargetOptions>,
  options?: Partial<LoggerOptions>,
): void {
  if (options?.logDir == null || options.logDir.length === 0) {
    return;
  }

  const logDir = options.logDir;

  // Validate and setup log directory
  try {
    setupLogDirectory(logDir);
  } catch (error) {
    throw new ConfigurationError(
      'Failed to setup log directory for file transport',
      error,
    );
  }

  const level = options.level ?? DEFAULT_LOG_LEVEL;
  const rotationOptions = options.fileRotationOptions;

  if (rotationOptions != null) {
    // Use pino-roll for file rotation
    targets.push(createRotationTransport(rotationOptions, logDir, level));
  } else {
    // Use basic file transport without rotation
    targets.push({
      target: 'pino/file',
      level,
      options: {
        destination: join(logDir, 'app.log'),
        mkdir: true,
      },
    });
  }
}

/**
 * Creates transport configuration for Pino
 *
 * Supports multiple transports:
 * - Console with pretty printing (development)
 * - File with rotation (production)
 *
 * @param options - Logger options
 * @returns Pino transport configuration
 */
function createTransport(
  options?: Partial<LoggerOptions>,
): pino.TransportMultiOptions | pino.TransportSingleOptions | undefined {
  const targets: Array<pino.TransportTargetOptions> = [];

  // Add console transport if needed
  addConsoleTransport(targets, options);

  // Add file transport if needed
  addFileTransport(targets, options);

  // If no targets, use default console
  if (targets.length === 0) {
    return undefined;
  }

  // If single target, return it directly
  if (targets.length === 1) {
    return { target: targets[0]!.target, options: targets[0]!.options };
  }

  // Multiple targets
  return {
    targets,
  };
}

/**
 * Add telemetry methods to the logger
 *
 * These methods allow setting/clearing/getting OpenTelemetry trace context
 * which will be automatically included in logs via the mixin function.
 *
 * @param logger - The Pino logger to enhance
 * @returns Enhanced logger with telemetry methods
 */
function enhanceLoggerWithTelemetry(logger: Logger): Logger {
  // Add setTraceContext method
  logger.setTraceContext = (context: SpanContext): void => {
    // Runtime validation is important even though TypeScript types ensure this
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof context !== 'object' || context === null) {
      throw new Error('Invalid trace context provided');
    }
    if (!context.traceId || !context.spanId) {
      throw new Error('Trace context must have traceId and spanId');
    }
    setTraceContext(getCurrentThreadId(), context);
  };

  // Add getTraceContext method
  logger.getTraceContext = (): SpanContext | undefined => {
    return getTraceContext(getCurrentThreadId());
  };

  // Add clearTraceContext method
  logger.clearTraceContext = (): void => {
    clearTraceContext(getCurrentThreadId());
  };

  return logger;
}

/**
 * Initialize the base Pino logger with sensible defaults
 *
 * Uses native Pino features for best performance and type safety:
 * - mixin for OpenTelemetry trace context
 * - serializers for error handling
 * - redact for sensitive data protection
 * - base for default metadata
 *
 * @returns Configured Logger instance
 */
function initializeBaseLogger(): Logger {
  try {
    const transport = createTransport();

    const rawLogger = pino({
      level: DEFAULT_LOG_LEVEL,
      serializers: createSerializers(),
      redact: createRedactionOptions(),
      base: {
        service: DEFAULT_SERVICE_NAME,
        env: DEFAULT_NODE_ENV,
      },
      ...(transport && { transport }),
      // Add mixin for OpenTelemetry trace context injection
      mixin: createTraceMixin(getCurrentThreadId),
    });

    // Cast to our Logger type (Pino logger is structurally compatible)
    const logger = rawLogger as Logger;

    // Add telemetry helper methods (setTraceContext, clearTraceContext)
    enhanceLoggerWithTelemetry(logger);

    return logger;
  } catch (error) {
    // Fallback to console logging if logger creation fails
    console.error(
      'Failed to initialize logger, falling back to console:',
      error,
    );
    throw new ConfigurationError('Logger initialization failed', error);
  }
}

// Initialize and export the base logger
let pinoLogger: Logger = initializeBaseLogger();

/**
 * Export the pre-initialized logger instance with sensible defaults
 */
export const baseLogger: Logger = pinoLogger;

/**
 * Get active trace context from OpenTelemetry API
 * Used when autoInject is enabled
 * @returns The active span context, or undefined if no active span
 */
function getActiveOtelContext(): SpanContext | undefined {
  try {
    const activeContext = context.active();
    const span = trace.getSpan(activeContext);

    if (span == null) {
      return undefined;
    }

    const spanContext = span.spanContext();

    // Convert OpenTelemetry span context to our SpanContext format
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags
        .toString(HEX_RADIX)
        .padStart(TRACE_FLAGS_PAD_LENGTH, '0'),
    };
  } catch {
    // If OpenTelemetry is not properly initialized, return undefined
    return undefined;
  }
}

/**
 * Creates the mixin function for trace context injection
 * @param options - Logger options with telemetry configuration
 * @returns Pino mixin function
 */
function createLoggerMixin(
  options?: Partial<LoggerOptions>,
): () => Record<string, unknown> {
  if (options?.telemetry?.enabled === true) {
    // Use autoInject if enabled, otherwise fall back to custom getActiveContext
    if (options.telemetry.autoInject === true) {
      return createTraceMixin(getCurrentThreadId, getActiveOtelContext);
    }

    if (options.telemetry.contextOptions?.getActiveContext != null) {
      return createTraceMixin(
        getCurrentThreadId,
        options.telemetry.contextOptions.getActiveContext,
      );
    }
  }

  return createTraceMixin(getCurrentThreadId);
}

/**
 * Creates the base metadata fields for the logger
 * @param options - Logger options
 * @param pinoBase - Additional base fields from pinoOptions passthrough
 * @returns Base configuration object
 */
function createBaseConfig(
  options?: Partial<LoggerOptions>,
  pinoBase?: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...pinoBase,
    service: options?.defaultService ?? DEFAULT_SERVICE_NAME,
    env: options?.nodeEnv ?? DEFAULT_NODE_ENV,
  };
}

/**
 * Creates Pino logger configuration object
 * @param options - Logger options
 * @param transport - Transport configuration
 * @returns Pino logger options
 */
function createPinoConfig(
  options: Partial<LoggerOptions> | undefined,
  transport:
    | pino.TransportMultiOptions
    | pino.TransportSingleOptions
    | undefined,
): pino.LoggerOptions {
  const pinoOptions = options?.pinoOptions;

  return {
    ...pinoOptions,
    level: options?.level ?? DEFAULT_LOG_LEVEL,
    serializers: createSerializers(),
    redact: createRedactionOptions(options?.redactPaths),
    base: createBaseConfig(options, pinoOptions?.base),
    ...(transport && { transport }),
    mixin: createLoggerMixin(options),
  };
}

/**
 * Initialize the logger with custom options
 *
 * This is optional - the exported baseLogger can be used directly without calling initLogger.
 *
 * Uses native Pino features for:
 * - Transport configuration (console, file with rotation)
 * - OpenTelemetry integration via mixin
 * - Sensitive data redaction
 * - Error serialization
 *
 * Note: Rate limiting is available separately via LogRateLimiter utilities.
 *
 * @param options - Optional logger configuration
 * @returns A promise that resolves with the configured Pino logger instance
 *
 * @example
 * ```typescript
 * const logger = await initLogger({
 *   level: 'debug',
 *   logDir: './logs',
 *   fileRotationOptions: {
 *     maxSize: '10m',
 *     maxFiles: 14,
 *     frequency: 'daily'
 *   },
 *   telemetry: {
 *     enabled: true,
 *     contextOptions: { injectTraceContext: true }
 *   }
 * });
 * ```
 */
export async function initLogger(
  options?: Partial<LoggerOptions>,
): Promise<Logger> {
  try {
    const transport = createTransport(options);
    const config = createPinoConfig(options, transport);
    const rawLogger = pino(config);

    // Cast to our Logger type (Pino logger is structurally compatible)
    const newLogger = rawLogger as Logger;

    // Add telemetry helper methods
    enhanceLoggerWithTelemetry(newLogger);

    // Update the global logger reference
    pinoLogger = newLogger;

    return newLogger;
  } catch (error) {
    // Log the error using the existing logger if available
    if (typeof pinoLogger !== 'undefined') {
      pinoLogger.error({ err: error }, 'Failed to initialize logger');
    } else {
      console.error('Failed to initialize logger:', error);
    }

    // Return the base logger as fallback
    return baseLogger;
  }
}

// =============================================================================
// NAMESPACE FILTERING
// =============================================================================

/** Current namespace configuration (set via initLogger) */
let namespaceConfig: NamespaceConfig = parseNamespacePatterns('*');

/** Reference to the current logger instance */
let currentLogger: Logger = pinoLogger;

/**
 * No-op logger that silently discards all log calls.
 * Used when a namespace is disabled.
 */
const noOpFn = (): void => {
  // Intentionally empty - logs are discarded
};

const noOpLogger: Logger = {
  fatal: noOpFn,
  error: noOpFn,
  warn: noOpFn,
  info: noOpFn,
  debug: noOpFn,
  trace: noOpFn,
  silent: noOpFn,
  level: 'silent',
  child: () => noOpLogger,
  setTraceContext: noOpFn,
  getTraceContext: () => undefined,
  clearTraceContext: noOpFn,
} as unknown as Logger;

/**
 * Set the namespace configuration for log filtering.
 * Called automatically by initLogger when namespaces option is provided.
 *
 * @param namespaces - Comma-separated namespace patterns
 *
 * @example
 * ```typescript
 * setNamespaceConfig('voice:*,twilio:*');
 * ```
 */
export function setNamespaceConfig(namespaces: string): void {
  namespaceConfig = parseNamespacePatterns(namespaces);
}

/**
 * Get the current namespace configuration.
 *
 * @returns The current namespace configuration
 */
export function getNamespaceConfig(): NamespaceConfig {
  return namespaceConfig;
}

/**
 * Create a component logger with namespace filtering.
 *
 * If the namespace is disabled by LOG_NAMESPACES, returns a no-op logger
 * that silently discards all log calls for zero performance impact.
 *
 * @param metadata - Service metadata for the component
 * @returns Logger instance (real or no-op based on namespace filtering)
 *
 * @example
 * ```typescript
 * // In voice-call-orchestrator.ts
 * const log = createComponentLogger({
 *   component: 'voice',
 *   layer: 'orchestrator',
 * });
 *
 * // Namespace: "voice:orchestrator"
 * // If LOG_NAMESPACES=voice:* this logs
 * // If LOG_NAMESPACES=http:* this is silently discarded
 * log.debug({ callId }, 'Call started');
 * ```
 */
export function createComponentLogger(metadata: ServiceMetadata): Logger {
  const namespace = buildNamespace(metadata);

  // Check if namespace is enabled
  if (!isNamespaceEnabled(namespace, namespaceConfig)) {
    return noOpLogger;
  }

  // Create real child logger with metadata
  return currentLogger.child({
    ...metadata,
    namespace,
  }) as Logger;
}

/**
 * Initialize the logger with custom options (enhanced version)
 *
 * This version also configures namespace filtering when the namespaces option is provided.
 *
 * @param options - Optional logger configuration including namespaces
 * @returns A promise that resolves with the configured Pino logger instance
 */
export async function initLoggerWithNamespaces(
  options?: Partial<LoggerOptions>,
): Promise<Logger> {
  // Configure namespace filtering if provided
  if (options?.namespaces != null) {
    setNamespaceConfig(options.namespaces);
  }

  // Initialize the logger
  const logger = await initLogger(options);

  // Update the current logger reference for createComponentLogger
  currentLogger = logger;

  return logger;
}
