/**
 * Tests for the main logger module
 *
 * Validates logger initialization, configuration, transport setup,
 * telemetry integration, and error handling.
 */

import type { LoggerOptions, SpanContext } from '../src/types';

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { baseLogger, initLogger } from '../src/logger';

// Test constants
const TEST_DIR_PREFIX = 'stern-logger-logger-test-';

describe('Logger Module', () => {
  let testLogDir: string;

  beforeEach(() => {
    // Create test directory
    testLogDir = join(tmpdir(), `${TEST_DIR_PREFIX}${Date.now()}`);
    mkdirSync(testLogDir, { recursive: true });
  });

  afterEach(async () => {
    // Wait for async pino-roll operations to settle before cleanup
    // This ensures file transport worker threads complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Clean up test directory
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('baseLogger', () => {
    test('should be initialized and available', () => {
      expect(baseLogger).toBeDefined();
      expect(typeof baseLogger).toBe('object');
    });

    test('should have standard Pino log methods', () => {
      expect(typeof baseLogger.trace).toBe('function');
      expect(typeof baseLogger.debug).toBe('function');
      expect(typeof baseLogger.info).toBe('function');
      expect(typeof baseLogger.warn).toBe('function');
      expect(typeof baseLogger.error).toBe('function');
      expect(typeof baseLogger.fatal).toBe('function');
    });

    test('should have telemetry methods', () => {
      expect(typeof baseLogger.setTraceContext).toBe('function');
      expect(typeof baseLogger.clearTraceContext).toBe('function');
    });

    test('should have child method', () => {
      expect(typeof baseLogger.child).toBe('function');
    });

    test('should be able to log messages', () => {
      expect(() => {
        baseLogger.info('Test message');
      }).not.toThrow();
    });

    test('should be able to log with objects', () => {
      expect(() => {
        baseLogger.info({ userId: '123' }, 'User action');
      }).not.toThrow();
    });

    test('should be able to create child loggers', () => {
      const childLogger = baseLogger.child({ module: 'test' });

      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });
  });

  describe('initLogger', () => {
    describe('Basic Initialization', () => {
      test('should initialize logger with no options', async () => {
        const logger = await initLogger();

        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
      });

      test('should initialize logger with custom level', async () => {
        const logger = await initLogger({ level: 'debug' });

        expect(logger).toBeDefined();
        expect(logger.level).toBe('debug');
      });

      test('should initialize logger with default service', async () => {
        const logger = await initLogger({ defaultService: 'test-service' });

        expect(logger).toBeDefined();
      });

      test('should initialize logger with custom nodeEnv', async () => {
        const logger = await initLogger({ nodeEnv: 'production' });

        expect(logger).toBeDefined();
      });

      test('should return a Promise', () => {
        const result = initLogger();

        expect(result).toBeInstanceOf(Promise);
      });

      test('should resolve to logger instance', async () => {
        const logger = await initLogger();

        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
      });
    });

    describe('File Logging', () => {
      test('should accept logDir option', async () => {
        const logger = await initLogger({ logDir: testLogDir });

        expect(logger).toBeDefined();
      });

      test('should create log directory if it does not exist', async () => {
        const newLogDir = join(testLogDir, 'new-logs');
        expect(existsSync(newLogDir)).toBe(false);

        await initLogger({ logDir: newLogDir });

        expect(existsSync(newLogDir)).toBe(true);
      });

      test('should handle existing log directory', async () => {
        expect(existsSync(testLogDir)).toBe(true);

        const logger = await initLogger({ logDir: testLogDir });

        expect(logger).toBeDefined();
      });

      test('should work without logDir', async () => {
        const logger = await initLogger();

        expect(logger).toBeDefined();
      });

      test('should handle empty logDir', async () => {
        const logger = await initLogger({ logDir: '' });

        expect(logger).toBeDefined();
      });
    });

    describe('File Rotation', () => {
      test('should accept file rotation options', async () => {
        const logger = await initLogger({
          logDir: testLogDir,
          fileRotationOptions: {
            maxSize: '10m',
            maxFiles: 14,
            frequency: 'daily',
          },
        });

        expect(logger).toBeDefined();
      });

      test('should accept partial rotation options', async () => {
        const logger = await initLogger({
          logDir: testLogDir,
          fileRotationOptions: {
            maxFiles: 7,
          },
        });

        expect(logger).toBeDefined();
      });

      test('should work with hourly rotation', async () => {
        const logger = await initLogger({
          logDir: testLogDir,
          fileRotationOptions: {
            frequency: 'hourly',
          },
        });

        expect(logger).toBeDefined();
      });

      test('should work without rotation options', async () => {
        const logger = await initLogger({ logDir: testLogDir });

        expect(logger).toBeDefined();
      });
    });

    describe('Pretty Printing', () => {
      test('should accept prettyPrint option', async () => {
        const logger = await initLogger({ prettyPrint: true });

        expect(logger).toBeDefined();
      });

      test('should work with prettyPrint disabled', async () => {
        const logger = await initLogger({ prettyPrint: false });

        expect(logger).toBeDefined();
      });

      test('should work without prettyPrint option', async () => {
        const logger = await initLogger();

        expect(logger).toBeDefined();
      });
    });

    describe('Telemetry', () => {
      test('should accept telemetry configuration', async () => {
        const logger = await initLogger({
          telemetry: {
            enabled: true,
          },
        });

        expect(logger).toBeDefined();
      });

      test('should have setTraceContext method', async () => {
        const logger = await initLogger();

        expect(typeof logger.setTraceContext).toBe('function');
      });

      test('should have clearTraceContext method', async () => {
        const logger = await initLogger();

        expect(typeof logger.clearTraceContext).toBe('function');
      });

      test('should allow setting trace context', async () => {
        const logger = await initLogger();

        const context: SpanContext = {
          traceId: 'trace-123',
          spanId: 'span-456',
          traceFlags: '1',
        };

        expect(() => {
          logger.setTraceContext?.(context);
        }).not.toThrow();
      });

      test('should allow clearing trace context', async () => {
        const logger = await initLogger();

        expect(() => {
          logger.clearTraceContext?.();
        }).not.toThrow();
      });

      test('should throw when setting invalid trace context', async () => {
        const logger = await initLogger();

        expect(() => {
          // @ts-expect-error - Testing invalid input
          logger.setTraceContext(null);
        }).toThrow('Invalid trace context provided');
      });

      test('should throw when trace context missing traceId', async () => {
        const logger = await initLogger();

        expect(() => {
          // @ts-expect-error - Testing invalid input
          logger.setTraceContext({ spanId: 'span-123' });
        }).toThrow('Trace context must have traceId and spanId');
      });

      test('should throw when trace context missing spanId', async () => {
        const logger = await initLogger();

        expect(() => {
          // @ts-expect-error - Testing invalid input
          logger.setTraceContext({ traceId: 'trace-123' });
        }).toThrow('Trace context must have traceId and spanId');
      });

      test('should work with telemetry disabled', async () => {
        const logger = await initLogger({
          telemetry: {
            enabled: false,
          },
        });

        expect(logger).toBeDefined();
      });
    });

    describe('Redaction', () => {
      test('should accept custom redact paths', async () => {
        const logger = await initLogger({
          redactPaths: ['customSecret', 'api.key'],
        });

        expect(logger).toBeDefined();
      });

      test('should work without custom redact paths', async () => {
        const logger = await initLogger();

        expect(logger).toBeDefined();
      });

      test('should work with empty redact paths array', async () => {
        const logger = await initLogger({ redactPaths: [] });

        expect(logger).toBeDefined();
      });
    });

    describe('Complex Configurations', () => {
      test('should handle full configuration', async () => {
        const options: Partial<LoggerOptions> = {
          level: 'debug',
          logDir: testLogDir,
          defaultService: 'test-service',
          nodeEnv: 'test',
          prettyPrint: false,
          redactPaths: ['secret'],
          fileRotationOptions: {
            maxSize: '5m',
            maxFiles: 10,
            frequency: 'daily',
          },
          telemetry: {
            enabled: true,
          },
        };

        const logger = await initLogger(options);

        expect(logger).toBeDefined();
        expect(logger.level).toBe('debug');
      });

      test('should handle partial configuration', async () => {
        const options: Partial<LoggerOptions> = {
          level: 'info',
          logDir: testLogDir,
        };

        const logger = await initLogger(options);

        expect(logger).toBeDefined();
      });

      test('should handle multiple logger instances', async () => {
        const logger1 = await initLogger({ level: 'info' });
        const logger2 = await initLogger({ level: 'debug' });

        expect(logger1).toBeDefined();
        expect(logger2).toBeDefined();
        expect(logger2.level).toBe('debug');
      });
    });

    describe('Error Handling', () => {
      test('should handle invalid log directory gracefully', async () => {
        const logger = await initLogger({ logDir: '\0invalid' });

        // Should return baseLogger as fallback
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
      });

      test('should not throw on initialization errors', async () => {
        expect(async () => {
          await initLogger({ logDir: '\0invalid' });
        }).not.toThrow();
      });
    });

    describe('Integration Tests', () => {
      test('should be able to log after initialization', async () => {
        const logger = await initLogger({ level: 'info' });

        expect(() => {
          logger.info('Test message');
        }).not.toThrow();
      });

      test('should be able to log with metadata', async () => {
        const logger = await initLogger({ level: 'info' });

        expect(() => {
          logger.info({ userId: '123', action: 'login' }, 'User logged in');
        }).not.toThrow();
      });

      test('should be able to create child loggers', async () => {
        const logger = await initLogger({ level: 'info' });
        const childLogger = logger.child({ module: 'auth' });

        expect(childLogger).toBeDefined();
        expect(() => {
          childLogger.info('Auth event');
        }).not.toThrow();
      });

      test('should be able to log errors', async () => {
        const logger = await initLogger({ level: 'error' });

        expect(() => {
          logger.error({ err: new Error('Test error') }, 'Error occurred');
        }).not.toThrow();
      });

      test('should be able to log at different levels', async () => {
        const logger = await initLogger({ level: 'trace' });

        expect(() => {
          logger.trace('Trace message');
          logger.debug('Debug message');
          logger.info('Info message');
          logger.warn('Warn message');
          logger.error('Error message');
        }).not.toThrow();
      });

      test('should work with trace context', async () => {
        const logger = await initLogger({
          telemetry: { enabled: true },
        });

        const context: SpanContext = {
          traceId: 'test-trace-id',
          spanId: 'test-span-id',
          traceFlags: '1',
        };

        logger.setTraceContext?.(context);

        expect(() => {
          logger.info('Message with trace context');
        }).not.toThrow();

        logger.clearTraceContext?.();

        expect(() => {
          logger.info('Message without trace context');
        }).not.toThrow();
      });

      test('should handle multiple initializations', async () => {
        const logger1 = await initLogger({ level: 'info' });
        const logger2 = await initLogger({ level: 'debug' });
        const logger3 = await initLogger({ level: 'warn' });

        expect(logger1).toBeDefined();
        expect(logger2).toBeDefined();
        expect(logger3).toBeDefined();
      });

      test('should handle concurrent initializations', async () => {
        const promises = [
          initLogger({ level: 'info' }),
          initLogger({ level: 'debug' }),
          initLogger({ level: 'warn' }),
        ];

        const loggers = await Promise.all(promises);

        expect(loggers).toHaveLength(3);
        loggers.forEach((logger) => {
          expect(logger).toBeDefined();
          expect(typeof logger.info).toBe('function');
        });
      });
    });

    describe('Edge Cases', () => {
      test('should handle very long service names', async () => {
        const longName = 'service-'.repeat(100);
        const logger = await initLogger({ defaultService: longName });

        expect(logger).toBeDefined();
      });

      test('should handle special characters in service name', async () => {
        const logger = await initLogger({ defaultService: 'test-service-🚀' });

        expect(logger).toBeDefined();
      });

      test('should handle deeply nested log directories', async () => {
        const deepDir = join(
          testLogDir,
          'level1',
          'level2',
          'level3',
          'level4',
          'logs',
        );

        const logger = await initLogger({ logDir: deepDir });

        expect(logger).toBeDefined();
        expect(existsSync(deepDir)).toBe(true);
      });

      test('should handle undefined options', async () => {
        const logger = await initLogger(undefined);

        expect(logger).toBeDefined();
      });

      test('should handle empty options object', async () => {
        const logger = await initLogger({});

        expect(logger).toBeDefined();
      });

      test('should handle trace context set/clear cycles', async () => {
        const logger = await initLogger();

        const context: SpanContext = {
          traceId: 'trace-123',
          spanId: 'span-456',
          traceFlags: '1',
        };

        expect(() => {
          logger.setTraceContext?.(context);
          logger.clearTraceContext?.();
          logger.setTraceContext?.(context);
          logger.clearTraceContext?.();
        }).not.toThrow();
      });

      test('should handle multiple child loggers', async () => {
        const logger = await initLogger();

        const child1 = logger.child({ module: 'module1' });
        const child2 = logger.child({ module: 'module2' });
        const child3 = logger.child({ module: 'module3' });

        expect(child1).toBeDefined();
        expect(child2).toBeDefined();
        expect(child3).toBeDefined();

        expect(() => {
          child1.info('Message 1');
          child2.info('Message 2');
          child3.info('Message 3');
        }).not.toThrow();
      });

      test('should handle very long log messages', async () => {
        const logger = await initLogger({ level: 'info' });
        const longMessage = 'Message '.repeat(1000);

        expect(() => {
          logger.info(longMessage);
        }).not.toThrow();
      });

      test('should handle logging with large objects', async () => {
        const logger = await initLogger({ level: 'info' });
        const largeObject = {
          users: Array.from({ length: 100 }, (_, i) => ({
            id: `user-${i}`,
            name: `User ${i}`,
            email: `user${i}@example.com`,
          })),
        };

        expect(() => {
          logger.info({ data: largeObject }, 'Large data log');
        }).not.toThrow();
      });

      test('should handle all log levels', async () => {
        const levels: Array<
          'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
        > = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

        for (const level of levels) {
          const logger = await initLogger({ level });
          expect(logger).toBeDefined();
          expect(logger.level).toBe(level);
        }
      });

      test('should handle custom redact paths with wildcards', async () => {
        const logger = await initLogger({
          redactPaths: ['user.*.password', 'api[*].key'],
        });

        expect(logger).toBeDefined();
      });
    });
  });

  describe('Logger Lifecycle', () => {
    test('should maintain logger instance across re-initializations', async () => {
      const logger1 = await initLogger({ level: 'info' });
      const logger2 = await initLogger({ level: 'debug' });

      // Both should be valid logger instances
      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();

      // Logger2 should have the new level
      expect(logger2.level).toBe('debug');
    });

    test('should handle rapid re-initializations', async () => {
      const logger1 = await initLogger({ level: 'info' });
      const logger2 = await initLogger({ level: 'debug' });
      const logger3 = await initLogger({ level: 'warn' });

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
      expect(logger3).toBeDefined();
    });

    test('should allow logging with each re-initialized logger', async () => {
      const logger1 = await initLogger({ level: 'info' });
      logger1.info('From logger 1');

      const logger2 = await initLogger({ level: 'debug' });
      logger2.debug('From logger 2');

      const logger3 = await initLogger({ level: 'warn' });
      logger3.warn('From logger 3');

      // All loggers should work
      expect(() => {
        logger1.info('Still working');
        logger2.debug('Still working');
        logger3.warn('Still working');
      }).not.toThrow();
    });
  });

  describe('Type Safety', () => {
    test('should accept valid LoggerOptions', async () => {
      const options: Partial<LoggerOptions> = {
        level: 'info',
        logDir: testLogDir,
        defaultService: 'test',
        nodeEnv: 'test',
        prettyPrint: true,
        redactPaths: ['password'],
        fileRotationOptions: {
          maxSize: '10m',
          maxFiles: 14,
          frequency: 'daily',
        },
        telemetry: {
          enabled: true,
        },
      };

      const logger = await initLogger(options);

      expect(logger).toBeDefined();
    });

    test('should accept SpanContext type', async () => {
      const logger = await initLogger();

      const context: SpanContext = {
        traceId: 'trace-id',
        spanId: 'span-id',
        traceFlags: '1',
      };

      expect(() => {
        logger.setTraceContext?.(context);
      }).not.toThrow();
    });
  });
});
