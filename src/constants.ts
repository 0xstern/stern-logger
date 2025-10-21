/**
 * @fileoverview Configuration constants and default values
 *
 * Defines environment-based defaults for logging levels, file rotation,
 * sensitive data redaction, validation limits, and telemetry settings.
 */

/* eslint-disable @typescript-eslint/no-magic-numbers */
/**
 * Default log level
 */
export const DEFAULT_LOG_LEVEL =
  process.env['LOG_LEVEL'] ??
  (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug');

/**
 * Default node environment
 */
export const DEFAULT_NODE_ENV = process.env['NODE_ENV'] ?? 'development';

/**
 * Default service name
 */
export const DEFAULT_SERVICE_NAME =
  process.env['LOG_DEFAULT_SERVICE_NAME'] ?? 'app';

/**
 * Default log directory
 */
export const LOG_DIRECTORY = process.env['LOG_DIR'] ?? './logs';

/**
 * File rotation defaults
 */
export const ROTATION_DEFAULTS = {
  MAX_SIZE: process.env['LOG_ROTATION_MAX_SIZE'] ?? '10m',
  MAX_FILES: Number(process.env['LOG_ROTATION_MAX_FILES']) || 14,
  FREQUENCY: (process.env['LOG_ROTATION_FREQUENCY'] === 'hourly'
    ? 'hourly'
    : 'daily') satisfies 'daily' | 'hourly',
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
 * Validation limits to prevent memory issues
 */
export const VALIDATION_LIMITS = {
  MAX_MESSAGE_LENGTH: Number(process.env['LOG_MAX_MESSAGE_LENGTH']) || 10000,
  MAX_META_SIZE: Number(process.env['LOG_MAX_META_SIZE']) || 1000000, // 1MB in bytes
  MAX_SERVICE_NAME_LENGTH:
    Number(process.env['LOG_MAX_SERVICE_NAME_LENGTH']) || 100,
  MAX_CONTEXT_FIELDS: Number(process.env['LOG_MAX_CONTEXT_FIELDS']) || 50,
  MAX_STRING_FIELD_LENGTH:
    Number(process.env['LOG_MAX_STRING_FIELD_LENGTH']) || 1000,
} as const;

/**
 * Memory size calculation constants
 */
export const MEMORY_SIZE = {
  CHARS_BYTES: 2, // UTF-16 encoding
  PRIMITIVE_BYTES: 8,
  MAX_ARRAY_LENGTH: 10,
  FALLBACK_OBJECT_BYTES: 100,
} as const;

/**
 * Time constants in milliseconds
 */
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_TELEMETRY_TTL_MINUTES = 5;
const DEFAULT_TELEMETRY_CLEANUP_INTERVAL_MINUTES = 1;

/**
 * Telemetry configuration defaults
 */
export const TELEMETRY_DEFAULTS = {
  MAX_CONTEXT_SIZE:
    Number(process.env['LOG_TELEMETRY_MAX_CONTEXT_SIZE']) || 10000,
  TTL_MS:
    Number(process.env['LOG_TELEMETRY_TTL_MS']) ||
    DEFAULT_TELEMETRY_TTL_MINUTES *
      SECONDS_PER_MINUTE *
      MILLISECONDS_PER_SECOND, // 5 minutes
  CLEANUP_INTERVAL_MS:
    Number(process.env['LOG_TELEMETRY_CLEANUP_INTERVAL_MS']) ||
    DEFAULT_TELEMETRY_CLEANUP_INTERVAL_MINUTES *
      SECONDS_PER_MINUTE *
      MILLISECONDS_PER_SECOND, // 1 minute
} as const;
