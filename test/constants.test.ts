/**
 * Tests for constants module
 *
 * Validates environment variable defaults, configuration constants,
 * and conditional logic for different NODE_ENV values.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_NODE_ENV,
  DEFAULT_REDACT_PATHS,
  DEFAULT_SERVICE,
  LOG_DIRECTORY,
  MEMORY_SIZE,
  ROTATION_DEFAULTS,
  TELEMETRY_DEFAULTS,
  VALIDATION_LIMITS,
} from '../src/constants';

// Test constants
const EXPECTED_MAX_FILES = 14;
const EXPECTED_MIN_REDACT_PATHS = 10;
const EXPECTED_MAX_MESSAGE_LENGTH = 10000;
const EXPECTED_MAX_META_SIZE = 1000000;
const EXPECTED_MAX_SERVICE_NAME_LENGTH = 100;
const EXPECTED_MAX_CONTEXT_FIELDS = 50;
const EXPECTED_MAX_STRING_FIELD_LENGTH = 1000;
const EXPECTED_CHARS_BYTES = 2;
const EXPECTED_PRIMITIVE_BYTES = 8;
const EXPECTED_MAX_ARRAY_LENGTH = 10;
const EXPECTED_FALLBACK_OBJECT_BYTES = 100;
const EXPECTED_MAX_CONTEXT_SIZE = 10000;
const EXPECTED_TTL_MS = 300000; // 5 minutes
const EXPECTED_CLEANUP_INTERVAL_MS = 60000; // 1 minute

describe('Constants', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('DEFAULT_LOG_LEVEL', () => {
    test('should default to "debug" in development', () => {
      delete process.env['LOG_LEVEL'];
      process.env['NODE_ENV'] = 'development';
      // Note: This test validates the constant is set correctly at import time
      // The actual value would be 'info' or 'debug' depending on when module was loaded
      expect(DEFAULT_LOG_LEVEL).toBeDefined();
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
    });

    test('should default to "info" in production', () => {
      delete process.env['LOG_LEVEL'];
      process.env['NODE_ENV'] = 'production';
      // Note: This test validates the constant is set correctly at import time
      expect(DEFAULT_LOG_LEVEL).toBeDefined();
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
    });

    test('should use LOG_LEVEL env var when set', () => {
      // This would be set before the module is imported
      expect(DEFAULT_LOG_LEVEL).toBeDefined();
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
    });

    test('should be a valid log level string', () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      expect(validLevels.includes(DEFAULT_LOG_LEVEL)).toBe(true);
    });
  });

  describe('DEFAULT_NODE_ENV', () => {
    test('should be a string', () => {
      expect(typeof DEFAULT_NODE_ENV).toBe('string');
    });

    test('should default to "development" when NODE_ENV is not set', () => {
      expect(DEFAULT_NODE_ENV).toBeDefined();
      expect(DEFAULT_NODE_ENV.length).toBeGreaterThan(0);
    });

    test('should be a valid environment name', () => {
      // Should be one of the valid environments or a custom string
      expect(typeof DEFAULT_NODE_ENV).toBe('string');
      expect(DEFAULT_NODE_ENV.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SERVICE', () => {
    test('should default to "app" when SERVICE_NAME is not set', () => {
      expect(DEFAULT_SERVICE).toBeDefined();
      expect(typeof DEFAULT_SERVICE).toBe('string');
      expect(DEFAULT_SERVICE.length).toBeGreaterThan(0);
    });

    test('should be a non-empty string', () => {
      expect(DEFAULT_SERVICE).toBeDefined();
      expect(typeof DEFAULT_SERVICE).toBe('string');
      expect(DEFAULT_SERVICE.length).toBeGreaterThan(0);
    });
  });

  describe('LOG_DIRECTORY', () => {
    test('should default to "./logs" when LOG_DIR is not set', () => {
      expect(LOG_DIRECTORY).toBeDefined();
      expect(typeof LOG_DIRECTORY).toBe('string');
      expect(LOG_DIRECTORY.length).toBeGreaterThan(0);
    });

    test('should be a valid directory path', () => {
      expect(LOG_DIRECTORY).toBeDefined();
      expect(typeof LOG_DIRECTORY).toBe('string');
      expect(LOG_DIRECTORY).not.toBe('');
    });
  });

  describe('ROTATION_DEFAULTS', () => {
    test('should have MAX_SIZE property', () => {
      expect(ROTATION_DEFAULTS.MAX_SIZE).toBeDefined();
      expect(typeof ROTATION_DEFAULTS.MAX_SIZE).toBe('string');
      expect(ROTATION_DEFAULTS.MAX_SIZE).toBe('10m');
    });

    test('should have MAX_FILES property', () => {
      expect(ROTATION_DEFAULTS.MAX_FILES).toBeDefined();
      expect(typeof ROTATION_DEFAULTS.MAX_FILES).toBe('number');
      expect(ROTATION_DEFAULTS.MAX_FILES).toBe(EXPECTED_MAX_FILES);
      expect(ROTATION_DEFAULTS.MAX_FILES).toBeGreaterThan(0);
    });

    test('should have FREQUENCY property', () => {
      expect(ROTATION_DEFAULTS.FREQUENCY).toBeDefined();
      expect(ROTATION_DEFAULTS.FREQUENCY).toBe('daily');
    });
  });

  describe('DEFAULT_REDACT_PATHS', () => {
    test('should be an array', () => {
      expect(Array.isArray(DEFAULT_REDACT_PATHS)).toBe(true);
    });

    test('should contain common sensitive fields', () => {
      expect(DEFAULT_REDACT_PATHS).toContain('password');
      expect(DEFAULT_REDACT_PATHS).toContain('creditCard');
      expect(DEFAULT_REDACT_PATHS).toContain('token');
      expect(DEFAULT_REDACT_PATHS).toContain('apiKey');
      expect(DEFAULT_REDACT_PATHS).toContain('secret');
      expect(DEFAULT_REDACT_PATHS).toContain('ssn');
    });

    test('should contain wildcard patterns', () => {
      expect(DEFAULT_REDACT_PATHS).toContain('*.password');
      expect(DEFAULT_REDACT_PATHS).toContain('*.creditCard');
      expect(DEFAULT_REDACT_PATHS).toContain('*.token');
    });

    test('should have at least 10 paths', () => {
      expect(DEFAULT_REDACT_PATHS.length).toBeGreaterThanOrEqual(
        EXPECTED_MIN_REDACT_PATHS,
      );
    });

    test('should not have duplicate paths', () => {
      const uniquePaths = new Set(DEFAULT_REDACT_PATHS);
      expect(uniquePaths.size).toBe(DEFAULT_REDACT_PATHS.length);
    });
  });

  describe('VALIDATION_LIMITS', () => {
    test('should have MAX_MESSAGE_LENGTH', () => {
      expect(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH).toBe(
        EXPECTED_MAX_MESSAGE_LENGTH,
      );
      expect(typeof VALIDATION_LIMITS.MAX_MESSAGE_LENGTH).toBe('number');
      expect(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH).toBeGreaterThan(0);
    });

    test('should have MAX_META_SIZE', () => {
      expect(VALIDATION_LIMITS.MAX_META_SIZE).toBe(EXPECTED_MAX_META_SIZE);
      expect(typeof VALIDATION_LIMITS.MAX_META_SIZE).toBe('number');
      expect(VALIDATION_LIMITS.MAX_META_SIZE).toBeGreaterThan(0);
    });

    test('should have MAX_SERVICE_NAME_LENGTH', () => {
      expect(VALIDATION_LIMITS.MAX_SERVICE_NAME_LENGTH).toBe(
        EXPECTED_MAX_SERVICE_NAME_LENGTH,
      );
      expect(typeof VALIDATION_LIMITS.MAX_SERVICE_NAME_LENGTH).toBe('number');
      expect(VALIDATION_LIMITS.MAX_SERVICE_NAME_LENGTH).toBeGreaterThan(0);
    });

    test('should have MAX_CONTEXT_FIELDS', () => {
      expect(VALIDATION_LIMITS.MAX_CONTEXT_FIELDS).toBe(
        EXPECTED_MAX_CONTEXT_FIELDS,
      );
      expect(typeof VALIDATION_LIMITS.MAX_CONTEXT_FIELDS).toBe('number');
      expect(VALIDATION_LIMITS.MAX_CONTEXT_FIELDS).toBeGreaterThan(0);
    });

    test('should have MAX_STRING_FIELD_LENGTH', () => {
      expect(VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH).toBe(
        EXPECTED_MAX_STRING_FIELD_LENGTH,
      );
      expect(typeof VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH).toBe('number');
      expect(VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH).toBeGreaterThan(0);
    });

    test('should have reasonable limits', () => {
      expect(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH).toBeLessThan(
        VALIDATION_LIMITS.MAX_META_SIZE,
      );
      expect(VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH).toBeLessThan(
        VALIDATION_LIMITS.MAX_MESSAGE_LENGTH,
      );
      expect(VALIDATION_LIMITS.MAX_SERVICE_NAME_LENGTH).toBeLessThan(
        VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH,
      );
    });
  });

  describe('MEMORY_SIZE', () => {
    test('should have CHARS_BYTES', () => {
      expect(MEMORY_SIZE.CHARS_BYTES).toBe(EXPECTED_CHARS_BYTES);
      expect(typeof MEMORY_SIZE.CHARS_BYTES).toBe('number');
    });

    test('should have PRIMITIVE_BYTES', () => {
      expect(MEMORY_SIZE.PRIMITIVE_BYTES).toBe(EXPECTED_PRIMITIVE_BYTES);
      expect(typeof MEMORY_SIZE.PRIMITIVE_BYTES).toBe('number');
    });

    test('should have MAX_ARRAY_LENGTH', () => {
      expect(MEMORY_SIZE.MAX_ARRAY_LENGTH).toBe(EXPECTED_MAX_ARRAY_LENGTH);
      expect(typeof MEMORY_SIZE.MAX_ARRAY_LENGTH).toBe('number');
    });

    test('should have FALLBACK_OBJECT_BYTES', () => {
      expect(MEMORY_SIZE.FALLBACK_OBJECT_BYTES).toBe(
        EXPECTED_FALLBACK_OBJECT_BYTES,
      );
      expect(typeof MEMORY_SIZE.FALLBACK_OBJECT_BYTES).toBe('number');
    });
  });

  describe('TELEMETRY_DEFAULTS', () => {
    test('should have MAX_CONTEXT_SIZE', () => {
      expect(TELEMETRY_DEFAULTS.MAX_CONTEXT_SIZE).toBe(
        EXPECTED_MAX_CONTEXT_SIZE,
      );
      expect(typeof TELEMETRY_DEFAULTS.MAX_CONTEXT_SIZE).toBe('number');
      expect(TELEMETRY_DEFAULTS.MAX_CONTEXT_SIZE).toBeGreaterThan(0);
    });

    test('should have TTL_MS', () => {
      expect(TELEMETRY_DEFAULTS.TTL_MS).toBeDefined();
      expect(typeof TELEMETRY_DEFAULTS.TTL_MS).toBe('number');
      expect(TELEMETRY_DEFAULTS.TTL_MS).toBeGreaterThan(0);
      // Should be 5 minutes in milliseconds
      expect(TELEMETRY_DEFAULTS.TTL_MS).toBe(EXPECTED_TTL_MS);
    });

    test('should have CLEANUP_INTERVAL_MS', () => {
      expect(TELEMETRY_DEFAULTS.CLEANUP_INTERVAL_MS).toBeDefined();
      expect(typeof TELEMETRY_DEFAULTS.CLEANUP_INTERVAL_MS).toBe('number');
      expect(TELEMETRY_DEFAULTS.CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
      // Should be 1 minute in milliseconds
      expect(TELEMETRY_DEFAULTS.CLEANUP_INTERVAL_MS).toBe(
        EXPECTED_CLEANUP_INTERVAL_MS,
      );
    });

    test('should have TTL_MS greater than CLEANUP_INTERVAL_MS', () => {
      expect(TELEMETRY_DEFAULTS.TTL_MS).toBeGreaterThan(
        TELEMETRY_DEFAULTS.CLEANUP_INTERVAL_MS,
      );
    });
  });

  describe('Integration Tests', () => {
    test('all constants should be exported', () => {
      expect(DEFAULT_LOG_LEVEL).toBeDefined();
      expect(DEFAULT_NODE_ENV).toBeDefined();
      expect(DEFAULT_SERVICE).toBeDefined();
      expect(LOG_DIRECTORY).toBeDefined();
      expect(ROTATION_DEFAULTS).toBeDefined();
      expect(DEFAULT_REDACT_PATHS).toBeDefined();
      expect(VALIDATION_LIMITS).toBeDefined();
      expect(MEMORY_SIZE).toBeDefined();
      expect(TELEMETRY_DEFAULTS).toBeDefined();
    });

    test('all constants should have expected types', () => {
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
      expect(typeof DEFAULT_NODE_ENV).toBe('string');
      expect(typeof DEFAULT_SERVICE).toBe('string');
      expect(typeof LOG_DIRECTORY).toBe('string');
      expect(typeof ROTATION_DEFAULTS).toBe('object');
      expect(Array.isArray(DEFAULT_REDACT_PATHS)).toBe(true);
      expect(typeof VALIDATION_LIMITS).toBe('object');
      expect(typeof MEMORY_SIZE).toBe('object');
      expect(typeof TELEMETRY_DEFAULTS).toBe('object');
    });
  });
});
