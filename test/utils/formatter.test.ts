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
      expect(options).toHaveProperty('ignore', 'pid,hostname');
      expect(options).toHaveProperty('messageFormat');
      expect(options).toHaveProperty('customLevels');
      expect(options).toHaveProperty('customColors');
    });

    test('should have messageFormat as a template string', () => {
      const options = createCustomPrettyOptions();

      expect(typeof options.messageFormat).toBe('string');
      expect(options.messageFormat).toBe(
        '{levelLabel} [{env}] [{service}] {msg}',
      );
    });

    test('should define custom level labels', () => {
      const options = createCustomPrettyOptions();
      const levels = options.customLevels as Record<number, string>;

      expect(levels[30]).toBe('INFO');
      expect(levels[50]).toBe('ERROR');
      expect(levels[20]).toBe('DEBUG');
    });
  });
});
