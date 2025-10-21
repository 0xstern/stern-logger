/**
 * Stern Logger - Enterprise-grade Pino-based logging library
 *
 * This library provides a production-ready logging solution with:
 * - Multiple log levels (fatal, error, warn, info, debug)
 * - Child logger support with hierarchical context
 * - Structured JSON logging
 * - File rotation with configurable retention (pino-roll)
 * - Pretty console formatting for development (pino-pretty)
 * - OpenTelemetry trace context correlation
 * - Sensitive data redaction (fast-redact)
 * - Exception and rejection handling
 * - Optional rate limiting utilities
 * - Input validation utilities
 * - Comprehensive error handling
 *
 * @example
 * ```typescript
 * import { baseLogger } from 'stern-logger';
 *
 * // Use the pre-configured logger
 * baseLogger.info('Application started');
 *
 * // Create a child logger with context
 * const userLogger = baseLogger.child({ component: 'user', operation: 'create' });
 * userLogger.info({ userId: '123' }, 'User created successfully');
 * ```
 *
 * @example
 * ```typescript
 * import { initLogger } from 'stern-logger';
 *
 * // Initialize with custom configuration
 * const logger = await initLogger({
 *   level: 'debug',
 *   defaultService: 'my-api',
 *   logDir: './logs',
 *   fileRotationOptions: {
 *     maxSize: '10m',
 *     maxFiles: 14,
 *     frequency: 'daily'
 *   }
 * });
 * ```
 */

// Core exports
export { baseLogger, initLogger } from './logger';

// Type exports
export type {
  FileRotationOptions,
  Logger,
  LoggerOptions,
  ServiceMetadata,
  SeverityLevel,
  SpanContext,
  TelemetryContextOptions,
  TelemetryOptions,
} from './types';

export { SEVERITY_LEVELS } from './types';

// Utility exports for advanced use cases
export { setupLogDirectory } from './utils/directory';

export {
  createSerializers,
  errorSerializer,
  formatErrorMessage,
  normalizeError,
} from './utils/error-handler';

export {
  registerProcessHandlers,
  unregisterProcessHandlers,
} from './utils/process-handlers';

export {
  createRedactionOptions,
  createRedactionPaths,
  type RedactionOptions,
} from './utils/redaction';

export {
  clearTraceContext,
  createTraceMixin,
  destroyTraceContextManager,
  getTraceContext,
  getTraceContextStats,
  setTraceContext,
} from './utils/telemetry';

export {
  getApproximateSize,
  isValidLogger,
  isWithinSizeLimit,
  validateAndCastLogger,
  validateMessage,
  validateServiceMetadata,
} from './utils/validation';

// Constant exports
export {
  DEFAULT_LOG_LEVEL,
  DEFAULT_NODE_ENV,
  DEFAULT_REDACT_PATHS,
  DEFAULT_SERVICE,
  LOG_DIRECTORY,
  ROTATION_DEFAULTS,
  TELEMETRY_DEFAULTS,
  VALIDATION_LIMITS,
} from './constants';
