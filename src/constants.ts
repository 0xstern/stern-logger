/**
 * @fileoverview Configuration constants and default values
 *
 * Defines pure default values for logging levels, file rotation,
 * sensitive data redaction, validation limits, and telemetry settings.
 *
 * Users should override these defaults in their configuration by reading
 * from environment variables, config files, or secret management systems.
 */

/**
 * Default log level
 * @default 'info'
 */
export const DEFAULT_LOG_LEVEL = 'info';

/**
 * Default node environment
 * @default 'development'
 */
export const DEFAULT_NODE_ENV = 'development';

/**
 * Default service name
 * @default 'app'
 */
export const DEFAULT_SERVICE_NAME = 'app';

/**
 * Default log directory
 * @default './logs'
 */
export const DEFAULT_LOG_DIRECTORY = './logs';

/**
 * Default file rotation options
 */
export const DEFAULT_ROTATION_OPTIONS = {
  MAX_SIZE: '10m',
  MAX_FILES: 14,
  FREQUENCY: 'daily' as const,
} as const;

/**
 * Default sensitive fields to redact
 */
export const DEFAULT_REDACT_PATHS = [
  'password',
  'creditCard',
  'auth',
  'authorization',
  'cookie',
  'token',
  'apiKey',
  'secret',
  'ssn',
  '*.password',
  '*.creditCard',
  '*.auth',
  '*.authorization',
  '*.cookie',
  '*.token',
  '*.apiKey',
  '*.secret',
  '*.ssn',
];

/**
 * Time constants in milliseconds
 */
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_TELEMETRY_TTL_MINUTES = 5;
const DEFAULT_TELEMETRY_CLEANUP_INTERVAL_MINUTES = 1;

/**
 * Default telemetry configuration
 */
export const DEFAULT_TELEMETRY_OPTIONS = {
  MAX_CONTEXT_SIZE: 10000,
  TTL_MS:
    DEFAULT_TELEMETRY_TTL_MINUTES *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND, // 5 minutes
  CLEANUP_INTERVAL_MS:
    DEFAULT_TELEMETRY_CLEANUP_INTERVAL_MINUTES *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND, // 1 minute
} as const;
