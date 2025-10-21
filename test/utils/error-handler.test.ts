/**
 * Tests for error handler utilities
 *
 * Validates custom error classes, error normalization,
 * error serialization for Pino, and error formatting.
 */

import { describe, expect, test } from 'bun:test';

import {
  ConfigurationError,
  createSerializers,
  errorSerializer,
  formatErrorMessage,
  LoggerError,
  ModuleLoadError,
  normalizeError,
  TransportError,
} from '../../src/utils/error-handler';

describe('Error Handler Utilities', () => {
  describe('LoggerError', () => {
    test('should create LoggerError with message', () => {
      const error = new LoggerError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(LoggerError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('LoggerError');
    });

    test('should have stack trace', () => {
      const error = new LoggerError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('LoggerError');
    });

    test('should capture proper stack trace', () => {
      const error = new LoggerError('Test error');

      expect(error.stack).toContain('test/utils/error-handler.test.ts');
    });
  });

  describe('ModuleLoadError', () => {
    test('should create ModuleLoadError with module name', () => {
      const error = new ModuleLoadError('test-module');

      expect(error).toBeInstanceOf(LoggerError);
      expect(error.message).toBe('Failed to load logger module: test-module');
      expect(error.name).toBe('ModuleLoadError');
    });

    test('should include cause if provided', () => {
      const cause = new Error('Original error');
      const error = new ModuleLoadError('test-module', cause);

      expect(error.cause).toBe(cause);
    });

    test('should work without cause', () => {
      const error = new ModuleLoadError('test-module');

      expect(error.cause).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    test('should create ConfigurationError with message', () => {
      const error = new ConfigurationError('Invalid config');

      expect(error).toBeInstanceOf(LoggerError);
      expect(error.message).toBe('Invalid config');
      expect(error.name).toBe('ConfigurationError');
    });

    test('should include cause if provided', () => {
      const cause = new Error('Root cause');
      const error = new ConfigurationError('Config failed', cause);

      expect(error.cause).toBe(cause);
    });

    test('should work without cause', () => {
      const error = new ConfigurationError('Config failed');

      expect(error.cause).toBeUndefined();
    });
  });

  describe('TransportError', () => {
    test('should create TransportError with transport name', () => {
      const error = new TransportError('file-transport');

      expect(error).toBeInstanceOf(LoggerError);
      expect(error.message).toBe(
        'Error in transport file-transport during logging',
      );
      expect(error.name).toBe('TransportError');
    });

    test('should create TransportError with operation', () => {
      const error = new TransportError('file-transport', 'rotation');

      expect(error.message).toBe(
        'Error in transport file-transport during rotation',
      );
    });

    test('should create TransportError with cause', () => {
      const cause = new Error('Disk full');
      const error = new TransportError('file-transport', cause);

      expect(error.cause).toBe(cause);
      expect(error.message).toBe(
        'Error in transport file-transport during logging',
      );
    });

    test('should prioritize string as operation over cause', () => {
      const error = new TransportError('console', 'formatting');

      expect(error.message).toContain('formatting');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('normalizeError', () => {
    test('should return Error instance unchanged', () => {
      const original = new Error('Test error');
      const normalized = normalizeError(original);

      expect(normalized).toBe(original);
    });

    test('should convert string to Error', () => {
      const normalized = normalizeError('String error');

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toBe('String error');
    });

    test('should convert number to Error', () => {
      const normalized = normalizeError(404);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('404');
    });

    test('should convert object to Error', () => {
      const normalized = normalizeError({ code: 'ERR_001', details: 'Failed' });

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('ERR_001');
      expect(normalized.message).toContain('Failed');
    });

    test('should convert null to Error', () => {
      const normalized = normalizeError(null);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('null');
    });

    test('should convert undefined to Error', () => {
      const normalized = normalizeError(undefined);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('Unknown error');
    });

    test('should preserve custom Error subclasses', () => {
      const custom = new LoggerError('Custom error');
      const normalized = normalizeError(custom);

      expect(normalized).toBe(custom);
      expect(normalized).toBeInstanceOf(LoggerError);
    });

    test('should handle boolean values', () => {
      const normalized = normalizeError(false);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('false');
    });

    test('should handle arrays', () => {
      const normalized = normalizeError(['error', 'details']);

      expect(normalized).toBeInstanceOf(Error);
      expect(normalized.message).toContain('error');
    });
  });

  describe('formatErrorMessage', () => {
    test('should format error without context', () => {
      const error = new Error('Test error');
      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('Test error');
    });

    test('should format error with empty context', () => {
      const error = new Error('Test error');
      const formatted = formatErrorMessage(error, {});

      expect(formatted).toBe('Test error');
    });

    test('should format error with context', () => {
      const error = new Error('Test error');
      const formatted = formatErrorMessage(error, {
        userId: '123',
        action: 'login',
      });

      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Context:');
      expect(formatted).toContain('userId');
      expect(formatted).toContain('123');
      expect(formatted).toContain('action');
      expect(formatted).toContain('login');
    });

    test('should format string error', () => {
      const formatted = formatErrorMessage('String error');

      expect(formatted).toBe('String error');
    });

    test('should format string error with context', () => {
      const formatted = formatErrorMessage('Failed', { code: 500 });

      expect(formatted).toContain('Failed');
      expect(formatted).toContain('code');
      expect(formatted).toContain('500');
    });

    test('should handle complex context objects', () => {
      const error = new Error('Complex error');
      const formatted = formatErrorMessage(error, {
        user: { id: '123', name: 'Test' },
        timestamp: Date.now(),
      });

      expect(formatted).toContain('Complex error');
      expect(formatted).toContain('user');
      expect(formatted).toContain('123');
      expect(formatted).toContain('Test');
    });

    test('should format nested errors', () => {
      const cause = new Error('Root cause');
      const error = new ConfigurationError('Config failed', cause);
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('Config failed');
    });
  });

  describe('errorSerializer', () => {
    test('should serialize standard Error', () => {
      const error = new Error('Test error');
      const serialized = errorSerializer(error);

      expect(serialized).toHaveProperty('type');
      expect(serialized).toHaveProperty('message');
      expect(serialized).toHaveProperty('stack');
      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('Test error');
    });

    test('should serialize custom Error subclass', () => {
      const error = new LoggerError('Logger error');
      const serialized = errorSerializer(error);

      expect(serialized.type).toBe('LoggerError');
      expect(serialized.message).toBe('Logger error');
      expect(serialized.stack).toBeDefined();
    });

    test('should serialize error with cause', () => {
      const cause = new Error('Root cause');
      const error = new ConfigurationError('Config error', cause);
      const serialized = errorSerializer(error);

      expect(serialized).toHaveProperty('cause');
      expect(serialized.cause).toHaveProperty('message');
      expect((serialized.cause as Record<string, unknown>).message).toBe(
        'Root cause',
      );
    });

    test('should serialize nested causes', () => {
      const rootCause = new Error('Root');
      const middleCause = new ConfigurationError('Middle', rootCause);
      const topError = new ModuleLoadError('Top', middleCause);
      const serialized = errorSerializer(topError);

      expect(serialized.cause).toBeDefined();
      const middle = serialized.cause as Record<string, unknown>;
      expect(middle.cause).toBeDefined();
    });

    test('should handle null error', () => {
      const serialized = errorSerializer(null);

      expect(serialized).toEqual({});
    });

    test('should handle undefined error', () => {
      const serialized = errorSerializer(undefined);

      expect(serialized).toEqual({});
    });

    test('should serialize error-like objects', () => {
      const errorLike = {
        name: 'CustomError',
        message: 'Custom message',
        stack: 'Stack trace',
      };
      const serialized = errorSerializer(errorLike);

      expect(serialized.type).toBe('CustomError');
      expect(serialized.message).toBe('Custom message');
      expect(serialized.stack).toBe('Stack trace');
    });

    test('should serialize objects without name', () => {
      const errorObj = { message: 'No name error' };
      const serialized = errorSerializer(errorObj);

      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('No name error');
    });

    test('should serialize primitive string', () => {
      const serialized = errorSerializer('String error');

      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('String error');
    });

    test('should serialize primitive number', () => {
      const serialized = errorSerializer(404);

      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('404');
    });

    test('should serialize primitive boolean', () => {
      const serialized = errorSerializer(false);

      expect(serialized.type).toBe('Error');
      expect(serialized.message).toBe('false');
    });

    test('should handle error-like object with cause', () => {
      const errorLike = {
        message: 'Error with cause',
        cause: new Error('Original'),
      };
      const serialized = errorSerializer(errorLike);

      expect(serialized).toHaveProperty('cause');
      expect((serialized.cause as Record<string, unknown>).message).toBe(
        'Original',
      );
    });

    test('should not include cause if undefined', () => {
      const error = new Error('No cause');
      const serialized = errorSerializer(error);

      expect(serialized).not.toHaveProperty('cause');
    });
  });

  describe('createSerializers', () => {
    test('should return object with err serializer', () => {
      const serializers = createSerializers();

      expect(serializers).toHaveProperty('err');
      expect(typeof serializers.err).toBe('function');
    });

    test('should return object with error serializer', () => {
      const serializers = createSerializers();

      expect(serializers).toHaveProperty('error');
      expect(typeof serializers.error).toBe('function');
    });

    test('should have both serializers pointing to same function', () => {
      const serializers = createSerializers();

      expect(serializers.err).toBe(serializers.error);
    });

    test('err serializer should work correctly', () => {
      const serializers = createSerializers();
      const error = new Error('Test');
      const result = serializers.err!(error);

      expect(result).toHaveProperty('message', 'Test');
    });

    test('error serializer should work correctly', () => {
      const serializers = createSerializers();
      const error = new LoggerError('Logger test');
      const result = serializers.error!(error);

      expect(result).toHaveProperty('message', 'Logger test');
      expect(result).toHaveProperty('type', 'LoggerError');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete error flow', () => {
      const rootCause = new Error('Database connection failed');
      const configError = new ConfigurationError(
        'Invalid database config',
        rootCause,
      );

      const normalized = normalizeError(configError);
      expect(normalized).toBe(configError);

      const formatted = formatErrorMessage(configError, {
        dbHost: 'localhost',
      });
      expect(formatted).toContain('Invalid database config');
      expect(formatted).toContain('dbHost');

      const serialized = errorSerializer(configError);
      expect(serialized.type).toBe('ConfigurationError');
      expect(serialized.cause).toBeDefined();
    });

    test('should handle transport error flow', () => {
      const diskError = new Error('ENOSPC: no space left on device');
      const transportError = new TransportError('file-transport', diskError);

      const serialized = errorSerializer(transportError);
      expect(serialized.type).toBe('TransportError');
      expect(serialized.message).toContain('file-transport');
      expect((serialized.cause as Record<string, unknown>).message).toContain(
        'ENOSPC',
      );
    });

    test('should handle module load error flow', () => {
      const loadError = new ModuleLoadError(
        'pino-roll',
        new Error('Module not found'),
      );

      const formatted = formatErrorMessage(loadError, {
        path: './node_modules',
      });
      expect(formatted).toContain('pino-roll');
      expect(formatted).toContain('path');

      const serialized = errorSerializer(loadError);
      expect(serialized.type).toBe('ModuleLoadError');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long error messages', () => {
      const longMessage = 'Error: '.repeat(1000);
      const error = new Error(longMessage);
      const serialized = errorSerializer(error);

      expect(serialized.message).toBe(longMessage);
    });

    test('should handle errors with special characters', () => {
      const error = new Error('Error: 🚀 Special chars: αβγ, 中文');
      const formatted = formatErrorMessage(error);

      expect(formatted).toContain('🚀');
      expect(formatted).toContain('αβγ');
      expect(formatted).toContain('中文');
    });

    test('should handle symbol values', () => {
      const sym = Symbol('error');
      const serialized = errorSerializer(sym);

      expect(serialized.type).toBe('Error');
      expect(serialized.message).toContain('Symbol');
    });

    test('should handle errors without stack trace', () => {
      const error = new Error('No stack') as Error & { stack?: string };
      delete error.stack;

      const serialized = errorSerializer(error);
      expect(serialized.message).toBe('No stack');
      expect(serialized.stack).toBeUndefined();
    });
  });
});
