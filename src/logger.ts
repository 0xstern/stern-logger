/**
 * @fileoverview Core logger implementation and initialization
 *
 * Provides logger initialization, transport configuration (console/file),
 * OpenTelemetry trace context integration, and telemetry method enhancement.
 */

import type { Logger, LoggerOptions, SpanContext } from './types';

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
 * Helper to add console transport if needed
 * @param targets - Array to add transport configuration to
 * @param options - Logger options
 */
function addConsoleTransport(
  targets: Array<pino.TransportTargetOptions>,
  options?: Partial<LoggerOptions>,
): void {
  // Default to pretty printing for better DX
  // Users can set prettyPrint: false for production
  const isPretty = options?.prettyPrint ?? true;
  if (isPretty) {
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
  return {
    level: options?.level ?? DEFAULT_LOG_LEVEL,
    serializers: createSerializers(),
    redact: createRedactionOptions(options?.redactPaths),
    base: {
      service: options?.defaultService ?? DEFAULT_SERVICE_NAME,
      env: options?.nodeEnv ?? DEFAULT_NODE_ENV,
    },
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
