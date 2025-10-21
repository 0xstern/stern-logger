/**
 * @fileoverview Main entry point for stern-logger library
 *
 * Stern Logger is an enterprise-grade Pino-based logging solution providing:
 * - Multiple log levels (fatal, error, warn, info, debug)
 * - Child logger support with hierarchical context
 * - Structured JSON logging
 * - File rotation with configurable retention (pino-roll)
 * - Pretty console formatting for development (pino-pretty)
 * - OpenTelemetry trace context correlation
 * - Sensitive data redaction (fast-redact)
 * - Exception and rejection handling
 * - Input validation utilities
 * - Comprehensive error handling
 *
 * @example Basic usage with pre-configured logger
 * ```typescript
 * import { baseLogger } from 'stern-logger';
 *
 * baseLogger.info('Application started');
 *
 * const userLogger = baseLogger.child({ component: 'user', operation: 'create' });
 * userLogger.info({ userId: '123' }, 'User created successfully');
 * ```
 *
 * @example Custom logger initialization
 * ```typescript
 * import { initLogger } from 'stern-logger';
 *
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
  DEFAULT_SERVICE_NAME,
  LOG_DIRECTORY,
  ROTATION_DEFAULTS,
  TELEMETRY_DEFAULTS,
  VALIDATION_LIMITS,
} from './constants';
