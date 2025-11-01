/**
 * Tests for custom formatter utilities
 */

import { describe, expect, test } from 'bun:test';

import { createCustomPrettyOptions } from '../../src/utils/formatter';

describe('Formatter', () => {
  describe('createCustomPrettyOptions', () => {
    test('should return valid pino-pretty options with defaults', () => {
      const options = createCustomPrettyOptions();

      expect(options).toHaveProperty('colorize', true);
      expect(options).toHaveProperty('translateTime', 'HH:MM:ss');
      expect(options).toHaveProperty('messageFormat');
    });

    test('should use default fields when no fields specified', () => {
      const options = createCustomPrettyOptions();

      expect(options.messageFormat).toBe(
        '{if pid}[{pid}]{end} {if hostname}[{hostname}]{end} {if env}[{env}]{end} {if service}[{service}]{end} \x1b[37m{msg}\x1b[39m',
      );
    });

    test('should allow custom field selection', () => {
      const options = createCustomPrettyOptions(['env', 'service']);

      expect(options.messageFormat).toBe(
        '{if env}[{env}]{end} {if service}[{service}]{end} \x1b[37m{msg}\x1b[39m',
      );
    });

    test('should handle single field', () => {
      const options = createCustomPrettyOptions(['service']);

      expect(options.messageFormat).toBe(
        '{if service}[{service}]{end} \x1b[37m{msg}\x1b[39m',
      );
    });

    test('should handle empty fields array', () => {
      const options = createCustomPrettyOptions([]);

      expect(options.messageFormat).toBe('\x1b[37m{msg}\x1b[39m');
    });

    test('should allow any field names', () => {
      const options = createCustomPrettyOptions(['requestId', 'userId']);

      expect(options.messageFormat).toBe(
        '{if requestId}[{requestId}]{end} {if userId}[{userId}]{end} \x1b[37m{msg}\x1b[39m',
      );
    });
  });
});
