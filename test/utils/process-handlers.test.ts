/**
 * Tests for process exception and rejection handlers
 *
 * Validates handler registration, unregistration, and error logging
 * for uncaught exceptions and unhandled promise rejections.
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import pino from 'pino';

import {
  registerProcessHandlers,
  unregisterProcessHandlers,
} from '../../src/utils/process-handlers';

// Test constants
const TEST_DIR_PREFIX = 'stern-logger-process-test-';

describe('Process Handlers', () => {
  let testLogDir: string;
  let mockLogger: pino.Logger;
  let originalProcessOn: typeof process.on;
  let originalProcessOff: typeof process.off;
  let registeredHandlers: Map<string, Set<(...args: Array<unknown>) => void>>;

  beforeEach(() => {
    // Create test directory
    testLogDir = join(tmpdir(), `${TEST_DIR_PREFIX}${Date.now()}`);
    mkdirSync(testLogDir, { recursive: true });

    // Create mock logger
    mockLogger = pino({ level: 'fatal' });
    mockLogger.fatal = mock(() => {});
    mockLogger.error = mock(() => {});

    // Track registered handlers
    registeredHandlers = new Map();

    // Save original process methods
    originalProcessOn = process.on.bind(process);
    originalProcessOff = process.off.bind(process);

    // Mock process.on to track handler registration
    process.on = mock(
      (event: string, handler: (...args: Array<unknown>) => void) => {
        if (!registeredHandlers.has(event)) {
          registeredHandlers.set(event, new Set());
        }
        registeredHandlers.get(event)?.add(handler);
        return originalProcessOn(event, handler);
      },
    ) as typeof process.on;

    // Mock process.off to track handler removal
    process.off = mock(
      (event: string, handler: (...args: Array<unknown>) => void) => {
        registeredHandlers.get(event)?.delete(handler);
        return originalProcessOff(event, handler);
      },
    ) as typeof process.off;
  });

  afterEach(async () => {
    // Clean up handlers
    unregisterProcessHandlers();

    // Restore original process methods
    process.on = originalProcessOn;
    process.off = originalProcessOff;

    // Wait for async pino-roll operations to settle before cleanup
    // This ensures file transport worker threads complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up test directory
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('registerProcessHandlers', () => {
    describe('Handler Registration', () => {
      test('should register uncaughtException handler', () => {
        registerProcessHandlers(mockLogger);

        expect(process.on).toHaveBeenCalledWith(
          'uncaughtException',
          expect.any(Function),
        );
      });

      test('should register unhandledRejection handler', () => {
        registerProcessHandlers(mockLogger);

        expect(process.on).toHaveBeenCalledWith(
          'unhandledRejection',
          expect.any(Function),
        );
      });

      test('should register both handlers', () => {
        registerProcessHandlers(mockLogger);

        expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
        expect(registeredHandlers.get('unhandledRejection')?.size).toBe(1);
      });

      test('should work without logDir', () => {
        expect(() => {
          registerProcessHandlers(mockLogger);
        }).not.toThrow();
      });

      test('should work with logDir', () => {
        expect(() => {
          registerProcessHandlers(mockLogger, testLogDir);
        }).not.toThrow();
      });

      test('should work with empty string logDir', () => {
        expect(() => {
          registerProcessHandlers(mockLogger, '');
        }).not.toThrow();

        // Should only register handlers, not create log files
        expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
      });
    });

    describe('Directory Setup', () => {
      test('should create log directory if it does not exist', () => {
        const newLogDir = join(testLogDir, 'new-logs');
        expect(existsSync(newLogDir)).toBe(false);

        registerProcessHandlers(mockLogger, newLogDir);

        expect(existsSync(newLogDir)).toBe(true);
      });

      test('should handle existing log directory', () => {
        expect(existsSync(testLogDir)).toBe(true);

        expect(() => {
          registerProcessHandlers(mockLogger, testLogDir);
        }).not.toThrow();
      });

      test('should log error if directory setup fails', () => {
        const invalidDir = '\0invalid';

        registerProcessHandlers(mockLogger, invalidDir);

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.anything() }),
          expect.stringContaining(
            'Failed to setup exception logging directory',
          ),
        );
      });

      test('should continue with main logger only if directory setup fails', () => {
        const invalidDir = '\0invalid';

        registerProcessHandlers(mockLogger, invalidDir);

        // Should still register handlers
        expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
        expect(registeredHandlers.get('unhandledRejection')?.size).toBe(1);
      });

      test('should create deeply nested log directories', () => {
        const deepDir = join(testLogDir, 'level1', 'level2', 'level3', 'logs');

        expect(() => {
          registerProcessHandlers(mockLogger, deepDir);
        }).not.toThrow();

        expect(existsSync(deepDir)).toBe(true);
      });
    });

    describe('Multiple Registrations', () => {
      test('should clean up old handlers before registering new ones', () => {
        registerProcessHandlers(mockLogger);
        const firstHandlerCount =
          registeredHandlers.get('uncaughtException')?.size;

        registerProcessHandlers(mockLogger);
        const secondHandlerCount =
          registeredHandlers.get('uncaughtException')?.size;

        expect(firstHandlerCount).toBe(1);
        expect(secondHandlerCount).toBe(1);
      });

      test('should allow re-registration with different logDir', async () => {
        registerProcessHandlers(mockLogger);

        const newLogDir = join(tmpdir(), `${TEST_DIR_PREFIX}${Date.now()}-new`);

        expect(() => {
          registerProcessHandlers(mockLogger, newLogDir);
        }).not.toThrow();

        // Wait for async operations before cleanup
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Clean up
        if (existsSync(newLogDir)) {
          rmSync(newLogDir, { recursive: true, force: true });
        }
      });

      test('should allow registration, unregistration, and re-registration', () => {
        registerProcessHandlers(mockLogger);
        unregisterProcessHandlers();
        registerProcessHandlers(mockLogger);

        expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
        expect(registeredHandlers.get('unhandledRejection')?.size).toBe(1);
      });
    });

    describe('Handler Behavior - Uncaught Exception', () => {
      test('should call logger.fatal for uncaught exception', () => {
        registerProcessHandlers(mockLogger);

        const testError = new Error('Test uncaught exception');
        const handlers = Array.from(
          registeredHandlers.get('uncaughtException') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testError);
        }

        expect(mockLogger.fatal).toHaveBeenCalledWith(
          expect.objectContaining({ err: testError }),
          expect.stringContaining('Uncaught exception'),
        );
      });

      test('should include error details in log', () => {
        registerProcessHandlers(mockLogger);

        const testError = new Error('Detailed error message');
        testError.stack = 'Error: Detailed error message\n    at Test';

        const handlers = Array.from(
          registeredHandlers.get('uncaughtException') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testError);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
        const calls = (mockLogger.fatal as ReturnType<typeof mock>).mock!
          .calls!;
        const [logObj] = calls[0]!;
        expect((logObj as { err: Error }).err.message).toBe(
          'Detailed error message',
        );
      });

      test('should not call process.exit', () => {
        const exitSpy = mock(() => {});
        const originalExit = process.exit;
        process.exit = exitSpy as never;

        try {
          registerProcessHandlers(mockLogger);

          const testError = new Error('Test error');
          const handlers = Array.from(
            registeredHandlers.get('uncaughtException') ?? [],
          );

          if (handlers.length > 0) {
            handlers[0]!(testError);
          }

          expect(exitSpy).not.toHaveBeenCalled();
        } finally {
          process.exit = originalExit;
        }
      });
    });

    describe('Handler Behavior - Unhandled Rejection', () => {
      test('should call logger.fatal for unhandled rejection with Error', () => {
        registerProcessHandlers(mockLogger);

        const testError = new Error('Test rejection');
        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testError);
        }

        expect(mockLogger.fatal).toHaveBeenCalledWith(
          expect.objectContaining({ err: expect.any(Error) }),
          expect.stringContaining('Unhandled promise rejection'),
        );
      });

      test('should normalize string rejection to Error', () => {
        registerProcessHandlers(mockLogger);

        const testReason = 'String rejection reason';
        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testReason);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
        const calls = (mockLogger.fatal as ReturnType<typeof mock>).mock!
          .calls!;
        const [logObj] = calls[0]!;
        expect((logObj as { err: Error }).err).toBeInstanceOf(Error);
        expect((logObj as { err: Error }).err.message).toBe(testReason);
      });

      test('should normalize object rejection to Error', () => {
        registerProcessHandlers(mockLogger);

        const testReason = { code: 'ERR_001', details: 'Something failed' };
        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testReason);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
        const calls = (mockLogger.fatal as ReturnType<typeof mock>).mock!
          .calls!;
        const [logObj] = calls[0]!;
        expect((logObj as { err: Error }).err).toBeInstanceOf(Error);
      });

      test('should normalize null rejection to Error', () => {
        registerProcessHandlers(mockLogger);

        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(null);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
        const calls = (mockLogger.fatal as ReturnType<typeof mock>).mock!
          .calls!;
        const [logObj] = calls[0]!;
        expect((logObj as { err: Error }).err).toBeInstanceOf(Error);
      });

      test('should normalize undefined rejection to Error', () => {
        registerProcessHandlers(mockLogger);

        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(undefined);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
        const calls = (mockLogger.fatal as ReturnType<typeof mock>).mock!
          .calls!;
        const [logObj] = calls[0]!;
        expect((logObj as { err: Error }).err).toBeInstanceOf(Error);
      });

      test('should normalize number rejection to Error', () => {
        registerProcessHandlers(mockLogger);

        const handlers = Array.from(
          registeredHandlers.get('unhandledRejection') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(42);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
      });
    });

    describe('File Logging', () => {
      test('should accept logDir parameter without throwing', () => {
        expect(() => {
          registerProcessHandlers(mockLogger, testLogDir);
        }).not.toThrow();
      });

      test('should still log to main logger when file logging enabled', () => {
        registerProcessHandlers(mockLogger, testLogDir);

        const testError = new Error('Test error');
        const handlers = Array.from(
          registeredHandlers.get('uncaughtException') ?? [],
        );

        if (handlers.length > 0) {
          handlers[0]!(testError);
        }

        expect(mockLogger.fatal).toHaveBeenCalled();
      });
    });
  });

  describe('unregisterProcessHandlers', () => {
    test('should remove uncaughtException handler', () => {
      registerProcessHandlers(mockLogger);
      unregisterProcessHandlers();

      expect(process.off).toHaveBeenCalledWith(
        'uncaughtException',
        expect.any(Function),
      );
    });

    test('should remove unhandledRejection handler', () => {
      registerProcessHandlers(mockLogger);
      unregisterProcessHandlers();

      expect(process.off).toHaveBeenCalledWith(
        'unhandledRejection',
        expect.any(Function),
      );
    });

    test('should clear all handler references', () => {
      registerProcessHandlers(mockLogger);
      unregisterProcessHandlers();

      expect(registeredHandlers.get('uncaughtException')?.size).toBe(0);
      expect(registeredHandlers.get('unhandledRejection')?.size).toBe(0);
    });

    test('should be safe to call without prior registration', () => {
      expect(() => {
        unregisterProcessHandlers();
      }).not.toThrow();
    });

    test('should be safe to call multiple times', () => {
      registerProcessHandlers(mockLogger);
      unregisterProcessHandlers();

      expect(() => {
        unregisterProcessHandlers();
      }).not.toThrow();
    });

    test('should allow re-registration after unregistration', () => {
      registerProcessHandlers(mockLogger);
      unregisterProcessHandlers();
      registerProcessHandlers(mockLogger);

      expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
      expect(registeredHandlers.get('unhandledRejection')?.size).toBe(1);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete registration and cleanup flow', () => {
      registerProcessHandlers(mockLogger, testLogDir);

      expect(registeredHandlers.get('uncaughtException')?.size).toBe(1);
      expect(registeredHandlers.get('unhandledRejection')?.size).toBe(1);

      unregisterProcessHandlers();

      expect(registeredHandlers.get('uncaughtException')?.size).toBe(0);
      expect(registeredHandlers.get('unhandledRejection')?.size).toBe(0);
    });

    test('should handle exception and rejection in sequence', () => {
      registerProcessHandlers(mockLogger);

      const exceptionHandlers = Array.from(
        registeredHandlers.get('uncaughtException') ?? [],
      );
      const rejectionHandlers = Array.from(
        registeredHandlers.get('unhandledRejection') ?? [],
      );

      if (exceptionHandlers.length > 0) {
        exceptionHandlers[0]!(new Error('First error'));
      }

      if (rejectionHandlers.length > 0) {
        rejectionHandlers[0]!('Rejection reason');
      }

      expect(mockLogger.fatal).toHaveBeenCalledTimes(2);
    });

    test('should work with multiple different logger instances', () => {
      const logger1 = pino({ level: 'fatal' });
      const logger2 = pino({ level: 'fatal' });

      logger1.fatal = mock(() => {});
      logger2.fatal = mock(() => {});

      registerProcessHandlers(logger1);
      unregisterProcessHandlers();
      registerProcessHandlers(logger2);

      const handlers = Array.from(
        registeredHandlers.get('uncaughtException') ?? [],
      );

      if (handlers.length > 0) {
        handlers[0]!(new Error('Test'));
      }

      expect(logger2.fatal).toHaveBeenCalled();
      expect(logger1.fatal).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle errors with very long messages', () => {
      registerProcessHandlers(mockLogger);

      const longMessage = 'Error: '.repeat(1000);
      const testError = new Error(longMessage);
      const handlers = Array.from(
        registeredHandlers.get('uncaughtException') ?? [],
      );

      if (handlers.length > 0) {
        handlers[0]!(testError);
      }

      expect(mockLogger.fatal).toHaveBeenCalled();
    });

    test('should handle errors with special characters', () => {
      registerProcessHandlers(mockLogger);

      const testError = new Error('Error: 🚀 Special chars: αβγ, 中文');
      const handlers = Array.from(
        registeredHandlers.get('uncaughtException') ?? [],
      );

      if (handlers.length > 0) {
        handlers[0]!(testError);
      }

      expect(mockLogger.fatal).toHaveBeenCalled();
    });

    test('should handle rejection with boolean value', () => {
      registerProcessHandlers(mockLogger);

      const handlers = Array.from(
        registeredHandlers.get('unhandledRejection') ?? [],
      );

      if (handlers.length > 0) {
        handlers[0]!(false);
      }

      expect(mockLogger.fatal).toHaveBeenCalled();
    });

    test('should handle rejection with array', () => {
      registerProcessHandlers(mockLogger);

      const handlers = Array.from(
        registeredHandlers.get('unhandledRejection') ?? [],
      );

      if (handlers.length > 0) {
        handlers[0]!(['error', 'details']);
      }

      expect(mockLogger.fatal).toHaveBeenCalled();
    });
  });
});
