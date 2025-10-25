/**
 * Tests for constants module
 *
 * Validates pure default configuration constants.
 */

import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_LOG_DIRECTORY,
  DEFAULT_LOG_LEVEL,
  DEFAULT_NODE_ENV,
  DEFAULT_REDACT_PATHS,
  DEFAULT_ROTATION_OPTIONS,
  DEFAULT_SERVICE_NAME,
  DEFAULT_TELEMETRY_OPTIONS,
} from '../src/constants';

// Test constants
const EXPECTED_MAX_FILES = 14;
const EXPECTED_MIN_REDACT_PATHS = 10;
const EXPECTED_MAX_CONTEXT_SIZE = 10000;
const EXPECTED_TTL_MS = 300000; // 5 minutes
const EXPECTED_CLEANUP_INTERVAL_MS = 60000; // 1 minute

describe('Constants', () => {
  describe('DEFAULT_LOG_LEVEL', () => {
    test('should be "info"', () => {
      expect(DEFAULT_LOG_LEVEL).toBe('info');
    });

    test('should be a string', () => {
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
    });

    test('should be a valid log level', () => {
      const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
      expect(validLevels).toContain(DEFAULT_LOG_LEVEL);
    });
  });

  describe('DEFAULT_NODE_ENV', () => {
    test('should be "development"', () => {
      expect(DEFAULT_NODE_ENV).toBe('development');
    });

    test('should be a non-empty string', () => {
      expect(typeof DEFAULT_NODE_ENV).toBe('string');
      expect(DEFAULT_NODE_ENV.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_SERVICE_NAME', () => {
    test('should be "app"', () => {
      expect(DEFAULT_SERVICE_NAME).toBe('app');
    });

    test('should be a non-empty string', () => {
      expect(typeof DEFAULT_SERVICE_NAME).toBe('string');
      expect(DEFAULT_SERVICE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_LOG_DIRECTORY', () => {
    test('should be "./logs"', () => {
      expect(DEFAULT_LOG_DIRECTORY).toBe('./logs');
    });

    test('should be a non-empty string', () => {
      expect(typeof DEFAULT_LOG_DIRECTORY).toBe('string');
      expect(DEFAULT_LOG_DIRECTORY.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_ROTATION_OPTIONS', () => {
    test('should have MAX_SIZE of "10m"', () => {
      expect(DEFAULT_ROTATION_OPTIONS.MAX_SIZE).toBe('10m');
      expect(typeof DEFAULT_ROTATION_OPTIONS.MAX_SIZE).toBe('string');
    });

    test('should have MAX_FILES of 14', () => {
      expect(DEFAULT_ROTATION_OPTIONS.MAX_FILES).toBe(EXPECTED_MAX_FILES);
      expect(typeof DEFAULT_ROTATION_OPTIONS.MAX_FILES).toBe('number');
      expect(DEFAULT_ROTATION_OPTIONS.MAX_FILES).toBeGreaterThan(0);
    });

    test('should have FREQUENCY of "daily"', () => {
      expect(DEFAULT_ROTATION_OPTIONS.FREQUENCY).toBe('daily');
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

  describe('DEFAULT_TELEMETRY_OPTIONS', () => {
    test('should have MAX_CONTEXT_SIZE of 10000', () => {
      expect(DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE).toBe(
        EXPECTED_MAX_CONTEXT_SIZE,
      );
      expect(typeof DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE).toBe('number');
      expect(DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE).toBeGreaterThan(0);
    });

    test('should have TTL_MS of 300000 (5 minutes)', () => {
      expect(DEFAULT_TELEMETRY_OPTIONS.TTL_MS).toBe(EXPECTED_TTL_MS);
      expect(typeof DEFAULT_TELEMETRY_OPTIONS.TTL_MS).toBe('number');
      expect(DEFAULT_TELEMETRY_OPTIONS.TTL_MS).toBeGreaterThan(0);
    });

    test('should have CLEANUP_INTERVAL_MS of 60000 (1 minute)', () => {
      expect(DEFAULT_TELEMETRY_OPTIONS.CLEANUP_INTERVAL_MS).toBe(
        EXPECTED_CLEANUP_INTERVAL_MS,
      );
      expect(typeof DEFAULT_TELEMETRY_OPTIONS.CLEANUP_INTERVAL_MS).toBe(
        'number',
      );
      expect(DEFAULT_TELEMETRY_OPTIONS.CLEANUP_INTERVAL_MS).toBeGreaterThan(0);
    });

    test('should have TTL_MS greater than CLEANUP_INTERVAL_MS', () => {
      expect(DEFAULT_TELEMETRY_OPTIONS.TTL_MS).toBeGreaterThan(
        DEFAULT_TELEMETRY_OPTIONS.CLEANUP_INTERVAL_MS,
      );
    });
  });

  describe('Integration Tests', () => {
    test('all constants should be defined', () => {
      expect(DEFAULT_LOG_LEVEL).toBeDefined();
      expect(DEFAULT_NODE_ENV).toBeDefined();
      expect(DEFAULT_SERVICE_NAME).toBeDefined();
      expect(DEFAULT_LOG_DIRECTORY).toBeDefined();
      expect(DEFAULT_ROTATION_OPTIONS).toBeDefined();
      expect(DEFAULT_REDACT_PATHS).toBeDefined();
      expect(DEFAULT_TELEMETRY_OPTIONS).toBeDefined();
    });

    test('all constants should have expected types', () => {
      expect(typeof DEFAULT_LOG_LEVEL).toBe('string');
      expect(typeof DEFAULT_NODE_ENV).toBe('string');
      expect(typeof DEFAULT_SERVICE_NAME).toBe('string');
      expect(typeof DEFAULT_LOG_DIRECTORY).toBe('string');
      expect(typeof DEFAULT_ROTATION_OPTIONS).toBe('object');
      expect(Array.isArray(DEFAULT_REDACT_PATHS)).toBe(true);
      expect(typeof DEFAULT_TELEMETRY_OPTIONS).toBe('object');
    });
  });
});
