/**
 * Tests for custom formatter utilities
 */

import { describe, expect, test } from 'bun:test';

import { createCustomPrettyOptions } from '../../src/utils/formatter';

describe('Formatter', () => {
  describe('createCustomPrettyOptions', () => {
    test('should return valid pino-pretty options', () => {
      const options = createCustomPrettyOptions();

      expect(options).toHaveProperty('colorize', true);
      expect(options).toHaveProperty('translateTime', 'HH:MM:ss');
      expect(options).toHaveProperty('ignore', 'pid,hostname,level');
      expect(options).toHaveProperty('messageFormat');
    });

    test('should have messageFormat as a string path', () => {
      const options = createCustomPrettyOptions();

      expect(typeof options.messageFormat).toBe('string');
      expect(options.messageFormat).toContain('pino-pretty-formatter.js');
    });
  });
});
