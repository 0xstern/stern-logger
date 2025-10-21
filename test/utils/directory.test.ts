/**
 * Tests for directory utilities
 *
 * Validates log directory setup, creation, and permission checking.
 * Uses temporary directories to avoid affecting the file system.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupLogDirectory } from '../../src/utils/directory';
import { ConfigurationError } from '../../src/utils/error-handler';

// Test constants
const TEST_DIR_PREFIX = 'stern-logger-test-';

describe('Directory Utilities', () => {
  let testBaseDir: string;

  beforeEach(() => {
    // Create a unique test directory in the system temp folder
    testBaseDir = join(tmpdir(), `${TEST_DIR_PREFIX}${Date.now()}`);
    mkdirSync(testBaseDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    try {
      if (existsSync(testBaseDir)) {
        // Reset permissions before deleting
        chmodSync(testBaseDir, 0o755);
        rmSync(testBaseDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  describe('setupLogDirectory', () => {
    describe('Input Validation', () => {
      test('should throw for non-string input', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          setupLogDirectory(123);
        }).toThrow(ConfigurationError);
      });

      test('should throw for empty string', () => {
        expect(() => {
          setupLogDirectory('');
        }).toThrow(ConfigurationError);
      });

      test('should throw for whitespace-only string', () => {
        expect(() => {
          setupLogDirectory('   ');
        }).toThrow(ConfigurationError);
      });

      test('should throw for null', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          setupLogDirectory(null);
        }).toThrow(ConfigurationError);
      });

      test('should throw for undefined', () => {
        expect(() => {
          // @ts-expect-error - Testing invalid input
          setupLogDirectory(undefined);
        }).toThrow(ConfigurationError);
      });
    });

    describe('Directory Creation', () => {
      test('should create directory if it does not exist', () => {
        const logDir = join(testBaseDir, 'new-logs');

        expect(existsSync(logDir)).toBe(false);

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should create nested directories', () => {
        const logDir = join(testBaseDir, 'deep', 'nested', 'logs');

        expect(existsSync(logDir)).toBe(false);

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should handle directories with spaces', () => {
        const logDir = join(testBaseDir, 'logs with spaces');

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should handle directories with special characters', () => {
        const logDir = join(testBaseDir, 'logs_with-special.chars');

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should handle relative paths', () => {
        const logDir = './test-logs-relative';

        setupLogDirectory(logDir);

        // Should resolve and create the directory
        expect(() => setupLogDirectory(logDir)).not.toThrow();

        // Clean up
        rmSync(logDir, { recursive: true, force: true });
      });

      test('should trim whitespace from path', () => {
        const logDir = join(testBaseDir, 'trimmed-logs');
        const pathWithSpaces = `  ${logDir}  `;

        setupLogDirectory(pathWithSpaces);

        expect(existsSync(logDir)).toBe(true);
      });
    });

    describe('Existing Directory', () => {
      test('should not throw if directory exists and is writable', () => {
        const logDir = join(testBaseDir, 'existing-logs');
        mkdirSync(logDir);

        expect(() => {
          setupLogDirectory(logDir);
        }).not.toThrow();
      });

      test('should handle calling setup multiple times', () => {
        const logDir = join(testBaseDir, 'logs');

        setupLogDirectory(logDir);
        expect(existsSync(logDir)).toBe(true);

        // Should not throw on second call
        expect(() => {
          setupLogDirectory(logDir);
        }).not.toThrow();
      });

      test('should verify existing directory is writable', () => {
        const logDir = join(testBaseDir, 'readonly-logs');
        mkdirSync(logDir);

        // Make directory read-only
        chmodSync(logDir, 0o444);

        expect(() => {
          setupLogDirectory(logDir);
        }).toThrow(ConfigurationError);

        // Restore permissions for cleanup
        chmodSync(logDir, 0o755);
      });
    });

    describe('Error Handling', () => {
      test('should throw ConfigurationError for invalid paths', () => {
        // Try to create a directory with an invalid character (null byte)
        expect(() => {
          setupLogDirectory('\0invalid');
        }).toThrow();
      });

      test('should include directory path in error message', () => {
        const logDir = join(testBaseDir, 'readonly-logs');
        mkdirSync(logDir);
        chmodSync(logDir, 0o444);

        try {
          setupLogDirectory(logDir);
          expect.unreachable('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationError);
          expect((error as Error).message).toContain(logDir);
          expect((error as Error).message).toContain('not writable');
        } finally {
          chmodSync(logDir, 0o755);
        }
      });

      test('should include cause in ConfigurationError', () => {
        const logDir = join(testBaseDir, 'readonly-logs');
        mkdirSync(logDir);
        chmodSync(logDir, 0o444);

        try {
          setupLogDirectory(logDir);
          expect.unreachable('Should have thrown');
        } catch (error) {
          expect(error).toBeInstanceOf(ConfigurationError);
          expect((error as ConfigurationError).cause).toBeDefined();
        } finally {
          chmodSync(logDir, 0o755);
        }
      });
    });

    describe('Path Resolution', () => {
      test('should resolve relative paths', () => {
        const relativePath = './test-logs';

        expect(() => {
          setupLogDirectory(relativePath);
        }).not.toThrow();

        // Clean up
        rmSync(relativePath, { recursive: true, force: true });
      });

      test('should resolve paths with ..', () => {
        const upPath = join(testBaseDir, 'subdir', '..', 'logs');

        setupLogDirectory(upPath);

        expect(existsSync(join(testBaseDir, 'logs'))).toBe(true);
      });

      test('should resolve paths with .', () => {
        const currentPath = join(testBaseDir, '.', 'logs');

        setupLogDirectory(currentPath);

        expect(existsSync(join(testBaseDir, 'logs'))).toBe(true);
      });
    });

    describe('Platform Compatibility', () => {
      test('should work with forward slashes', () => {
        const logDir = testBaseDir + '/forward/slash/logs';

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should handle very long directory names', () => {
        const longName = 'a'.repeat(100);
        const logDir = join(testBaseDir, longName);

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });

      test('should handle deeply nested directories', () => {
        const parts = Array.from({ length: 10 }, (_, i) => `level${i}`);
        const logDir = join(testBaseDir, ...parts);

        setupLogDirectory(logDir);

        expect(existsSync(logDir)).toBe(true);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should allow file creation in setup directory', () => {
      const logDir = join(testBaseDir, 'integration-logs');

      setupLogDirectory(logDir);

      // Should be able to write a file
      const testFile = join(logDir, 'test.log');
      expect(() => {
        writeFileSync(testFile, 'test content');
      }).not.toThrow();

      expect(existsSync(testFile)).toBe(true);
    });

    test('should work with subsequent directory operations', () => {
      const logDir = join(testBaseDir, 'operational-logs');

      setupLogDirectory(logDir);

      // Should be able to create subdirectories
      const subDir = join(logDir, 'archive');
      mkdirSync(subDir);

      expect(existsSync(subDir)).toBe(true);
    });

    test('should support multiple independent log directories', () => {
      const logDir1 = join(testBaseDir, 'logs1');
      const logDir2 = join(testBaseDir, 'logs2');

      setupLogDirectory(logDir1);
      setupLogDirectory(logDir2);

      expect(existsSync(logDir1)).toBe(true);
      expect(existsSync(logDir2)).toBe(true);
    });
  });
});
