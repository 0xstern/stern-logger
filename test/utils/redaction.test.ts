/**
 * Tests for redaction utilities
 *
 * Validates redaction path creation, redaction options configuration,
 * and Pino fast-redact integration.
 */

import { describe, expect, test } from 'bun:test';

import { DEFAULT_REDACT_PATHS } from '../../src/constants';
import {
  createRedactionOptions,
  createRedactionPaths,
} from '../../src/utils/redaction';

describe('Redaction Utilities', () => {
  describe('createRedactionPaths', () => {
    test('should return default paths when no custom paths provided', () => {
      const paths = createRedactionPaths();
      expect(paths).toEqual([...DEFAULT_REDACT_PATHS]);
    });

    test('should return default paths when empty array provided', () => {
      const paths = createRedactionPaths([]);
      expect(paths).toEqual([...DEFAULT_REDACT_PATHS]);
    });

    test('should combine default and custom paths', () => {
      const customPaths = ['customSecret', 'api.key'];
      const paths = createRedactionPaths(customPaths);

      expect(paths).toContain('password');
      expect(paths).toContain('customSecret');
      expect(paths).toContain('api.key');
      expect(paths.length).toBe(
        DEFAULT_REDACT_PATHS.length + customPaths.length,
      );
    });

    test('should remove duplicate paths', () => {
      const customPaths = ['password', 'newSecret'];
      const paths = createRedactionPaths(customPaths);

      const passwordCount = paths.filter((p) => p === 'password').length;
      expect(passwordCount).toBe(1);
    });

    test('should handle wildcard paths', () => {
      const customPaths = ['user.*.password', 'data[*].secret'];
      const paths = createRedactionPaths(customPaths);

      expect(paths).toContain('user.*.password');
      expect(paths).toContain('data[*].secret');
    });

    test('should handle bracket notation paths', () => {
      const customPaths = ['user["api-key"]', 'data["auth-token"]'];
      const paths = createRedactionPaths(customPaths);

      expect(paths).toContain('user["api-key"]');
      expect(paths).toContain('data["auth-token"]');
    });

    test('should handle nested paths', () => {
      const customPaths = ['user.credentials.password', 'api.auth.token'];
      const paths = createRedactionPaths(customPaths);

      expect(paths).toContain('user.credentials.password');
      expect(paths).toContain('api.auth.token');
    });

    test('should preserve all default redact paths', () => {
      const paths = createRedactionPaths(['custom']);

      // Verify key default paths are included
      expect(paths).toContain('password');
      expect(paths).toContain('creditCard');
      expect(paths).toContain('token');
      expect(paths).toContain('apiKey');
      expect(paths).toContain('secret');
      expect(paths).toContain('ssn');
    });

    test('should preserve wildcard default paths', () => {
      const paths = createRedactionPaths();

      expect(paths).toContain('*.password');
      expect(paths).toContain('*.creditCard');
      expect(paths).toContain('*.token');
    });
  });

  describe('createRedactionOptions', () => {
    test('should create default options with default censor', () => {
      const options = createRedactionOptions();

      expect(options.paths).toEqual([...DEFAULT_REDACT_PATHS]);
      expect(options.censor).toBe('[REDACTED]');
      expect(options.remove).toBeUndefined();
    });

    test('should create options with custom censor string', () => {
      const options = createRedactionOptions(undefined, '***');

      expect(options.censor).toBe('***');
      expect(options.remove).toBeUndefined();
    });

    test('should create options with remove enabled', () => {
      const options = createRedactionOptions(undefined, undefined, true);

      expect(options.remove).toBe(true);
      expect(options.censor).toBeUndefined();
    });

    test('should create options with custom paths', () => {
      const customPaths = ['customField', 'api.secret'];
      const options = createRedactionOptions(customPaths);

      expect(options.paths).toContain('password');
      expect(options.paths).toContain('customField');
      expect(options.paths).toContain('api.secret');
    });

    test('should create options with custom paths and censor', () => {
      const customPaths = ['secret'];
      const options = createRedactionOptions(customPaths, '###');

      expect(options.paths).toContain('secret');
      expect(options.censor).toBe('###');
    });

    test('should create options with custom paths and remove', () => {
      const customPaths = ['sensitive'];
      const options = createRedactionOptions(customPaths, undefined, true);

      expect(options.paths).toContain('sensitive');
      expect(options.remove).toBe(true);
      expect(options.censor).toBeUndefined();
    });

    test('should prioritize remove over censor', () => {
      const options = createRedactionOptions(undefined, 'CUSTOM', true);

      expect(options.remove).toBe(true);
      expect(options.censor).toBeUndefined();
    });

    test('should handle empty custom paths with censor', () => {
      const options = createRedactionOptions([], '---');

      expect(options.paths).toEqual([...DEFAULT_REDACT_PATHS]);
      expect(options.censor).toBe('---');
    });

    test('should handle empty custom paths with remove', () => {
      const options = createRedactionOptions([], undefined, true);

      expect(options.paths).toEqual([...DEFAULT_REDACT_PATHS]);
      expect(options.remove).toBe(true);
    });

    test('should create valid Pino redaction config structure', () => {
      const options = createRedactionOptions(['test']);

      expect(options).toHaveProperty('paths');
      expect(Array.isArray(options.paths)).toBe(true);
      // Censor should be a string when remove is not enabled
      expect(options.censor).toBe('[REDACTED]');
      expect(options.remove).toBeUndefined();
    });

    test('should handle multiple custom paths with remove', () => {
      const customPaths = ['field1', 'field2', 'field3'];
      const options = createRedactionOptions(customPaths, undefined, true);

      expect(options.paths.length).toBeGreaterThan(customPaths.length);
      customPaths.forEach((path) => {
        expect(options.paths).toContain(path);
      });
      expect(options.remove).toBe(true);
    });

    test('should handle complex path patterns', () => {
      const customPaths = [
        'user.*.credentials',
        'api["auth-header"]',
        'data.nested.deep.secret',
      ];
      const options = createRedactionOptions(customPaths, '[HIDDEN]');

      customPaths.forEach((path) => {
        expect(options.paths).toContain(path);
      });
      expect(options.censor).toBe('[HIDDEN]');
    });
  });

  describe('Integration Tests', () => {
    test('should create consistent options across multiple calls', () => {
      const options1 = createRedactionOptions(['test']);
      const options2 = createRedactionOptions(['test']);

      expect(options1.paths).toEqual(options2.paths);
      expect(options1.censor).toEqual(options2.censor);
    });

    test('should handle all default redaction fields', () => {
      const options = createRedactionOptions();

      const expectedDefaults = [
        'password',
        'creditCard',
        'auth',
        'authorization',
        'cookie',
        'token',
        'apiKey',
        'secret',
        'ssn',
      ];

      expectedDefaults.forEach((field) => {
        expect(options.paths).toContain(field);
      });
    });

    test('should support Pino redaction configuration', () => {
      const options = createRedactionOptions(['custom'], '***', false);

      // Verify it has the structure Pino expects
      expect(options).toMatchObject({
        paths: expect.any(Array),
        censor: expect.any(String),
      });
    });

    test('should support Pino remove configuration', () => {
      const options = createRedactionOptions(['custom'], undefined, true);

      // Verify it has the structure Pino expects for removal
      expect(options).toMatchObject({
        paths: expect.any(Array),
        remove: true,
      });
    });

    test('should not mutate default paths', () => {
      const defaultPathsBefore = [...DEFAULT_REDACT_PATHS];

      createRedactionOptions(['newPath']);

      expect(DEFAULT_REDACT_PATHS).toEqual(defaultPathsBefore);
    });

    test('should create unique path arrays', () => {
      const options1 = createRedactionOptions(['test1']);
      const options2 = createRedactionOptions(['test2']);

      options1.paths.push('modified');

      expect(options2.paths).not.toContain('modified');
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined paths parameter', () => {
      const options = createRedactionOptions(undefined, '[CENSORED]');

      expect(options.paths).toEqual([...DEFAULT_REDACT_PATHS]);
      expect(options.censor).toBe('[CENSORED]');
    });

    test('should handle empty string censor', () => {
      const options = createRedactionOptions(undefined, '');

      expect(options.censor).toBe('');
    });

    test('should handle very long censor string', () => {
      const longCensor = 'X'.repeat(1000);
      const options = createRedactionOptions(undefined, longCensor);

      expect(options.censor).toBe(longCensor);
    });

    test('should handle special characters in censor', () => {
      const specialCensor = '🔒[REDACTED]🔒';
      const options = createRedactionOptions(undefined, specialCensor);

      expect(options.censor).toBe(specialCensor);
    });

    test('should handle very long custom paths', () => {
      const longPath = 'a.'.repeat(100) + 'secret';
      const options = createRedactionOptions([longPath]);

      expect(options.paths).toContain(longPath);
    });

    test('should handle many custom paths', () => {
      const manyPaths = Array.from({ length: 100 }, (_, i) => `field${i}`);
      const options = createRedactionOptions(manyPaths);

      expect(options.paths.length).toBeGreaterThanOrEqual(100);
    });

    test('should handle paths with special characters', () => {
      const specialPaths = [
        'field-with-dashes',
        'field_with_underscores',
        'field$with$dollars',
      ];
      const options = createRedactionOptions(specialPaths);

      specialPaths.forEach((path) => {
        expect(options.paths).toContain(path);
      });
    });

    test('should handle boolean false for remove parameter', () => {
      const options = createRedactionOptions(undefined, 'test', false);

      expect(options.remove).toBeUndefined();
      expect(options.censor).toBe('test');
    });
  });
});
