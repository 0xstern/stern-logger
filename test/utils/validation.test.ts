/**
 * Tests for validation utilities
 *
 * Validates message sanitization, service metadata validation,
 * logger validation, and size calculation functions.
 */

import type { SpanContext } from '../../src/types';

import { describe, expect, test } from 'bun:test';
import pino from 'pino';

import { VALIDATION_LIMITS } from '../../src/constants';
import {
  getApproximateSize,
  isValidLogger,
  isWithinSizeLimit,
  validateAndCastLogger,
  validateMessage,
  validateServiceMetadata,
} from '../../src/utils/validation';

// Test constants
const TEST_NUMBER = 42;
const TEST_PI = 3.14;
const TEST_NUMBER_OFFSET = 81;
const TEST_ARRAY_1_2_3 = [1, 2, 3] as const;
const TRUNCATE_BUFFER = 100;
const LONG_FIELD_BUFFER = 10;
const FIELD_LIMIT_BUFFER = 10;
const UTF16_CHAR_SIZE = 2;
const PRIMITIVE_SIZE = 8;
const LOOP_COUNT_LARGE = 100;
const SIZE_THRESHOLD_LARGE = 1000;
const LOOP_COUNT_WIDE = 1000;
const PERF_TEST_TIMEOUT_MS = 1000;
const TEST_ARRAY_1_2_3_4_5 = [1, 2, 3, 4, 5] as const;
const LARGE_ARRAY_SIZE = 10000;
const SIZE_DIVISOR_HALF = 2;
const SIZE_DIVISOR_QUARTER = 4;

describe('Validation Utilities', () => {
  describe('validateMessage', () => {
    test('should handle null and undefined messages', () => {
      expect(validateMessage(null)).toBe('');
      expect(validateMessage(undefined)).toBe('');
    });

    test('should convert non-string messages to strings', () => {
      expect(validateMessage(TEST_NUMBER)).toBe('42');
      expect(validateMessage(true)).toBe('true');
      expect(validateMessage(false)).toBe('false');
      expect(validateMessage({ key: 'value' })).toBe('[object Object]');
      expect(validateMessage(TEST_ARRAY_1_2_3)).toBe('1,2,3');
    });

    test('should return string messages unchanged if within limit', () => {
      const message = 'This is a test message';
      expect(validateMessage(message)).toBe(message);
    });

    test('should truncate messages exceeding max length', () => {
      const longMessage = 'x'.repeat(
        VALIDATION_LIMITS.MAX_MESSAGE_LENGTH + TRUNCATE_BUFFER,
      );
      const result = validateMessage(longMessage);

      expect(result.length).toBe(
        VALIDATION_LIMITS.MAX_MESSAGE_LENGTH + '... [truncated]'.length,
      );
      expect(result.endsWith('... [truncated]')).toBe(true);
      expect(result.startsWith('xxxx')).toBe(true);
    });

    test('should handle edge case at exact max length', () => {
      const exactMessage = 'x'.repeat(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH);
      const result = validateMessage(exactMessage);

      expect(result).toBe(exactMessage);
      expect(result.length).toBe(VALIDATION_LIMITS.MAX_MESSAGE_LENGTH);
      expect(result.includes('truncated')).toBe(false);
    });

    test('should handle empty strings', () => {
      expect(validateMessage('')).toBe('');
    });

    test('should handle special characters and unicode', () => {
      const specialMessage = '🚀 Special chars: αβγ, 中文, emojis! 🎉';
      expect(validateMessage(specialMessage)).toBe(specialMessage);
    });

    test('should handle objects with toString methods', () => {
      const obj = {
        toString() {
          return 'custom string';
        },
      };
      expect(validateMessage(obj)).toBe('custom string');
    });

    test('should handle numbers including zero', () => {
      expect(validateMessage(0)).toBe('0');
      expect(validateMessage(-1)).toBe('-1');
      expect(validateMessage(TEST_PI)).toBe('3.14');
    });

    test('should handle special number values', () => {
      expect(validateMessage(Infinity)).toBe('Infinity');
      expect(validateMessage(-Infinity)).toBe('-Infinity');
      expect(validateMessage(NaN)).toBe('NaN');
    });

    test('should handle symbols', () => {
      const sym = Symbol('test');
      const result = validateMessage(sym);
      expect(result).toBe('Symbol(test)');
    });
  });

  describe('validateServiceMetadata', () => {
    test('should return empty object for null/undefined input', () => {
      expect(validateServiceMetadata(null)).toEqual({});
      expect(validateServiceMetadata(undefined)).toEqual({});
    });

    test('should return empty object for non-object input', () => {
      expect(validateServiceMetadata('not an object')).toEqual({});
      expect(validateServiceMetadata(TEST_NUMBER)).toEqual({});
      expect(validateServiceMetadata(true)).toEqual({});
    });

    test('should validate known service metadata fields', () => {
      const metadata = {
        service: 'test-service',
        component: 'test-component',
        operation: 'test-operation',
        layer: 'handler',
        domain: 'auth',
        integration: 'stripe',
      };

      const result = validateServiceMetadata(metadata);
      expect(result).toEqual(metadata);
    });

    test('should convert non-string known fields to strings', () => {
      const metadata = {
        service: 123,
        component: true,
        operation: null,
        layer: undefined,
      };

      const result = validateServiceMetadata(metadata);
      expect(result).toEqual({
        service: '123',
        component: 'true',
      });
    });

    test('should truncate long string fields', () => {
      const longString = 'x'.repeat(
        VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH + LONG_FIELD_BUFFER,
      );
      const metadata = {
        service: longString,
        component: 'valid-component',
      };

      const result = validateServiceMetadata(metadata);
      // The long string should be undefined (filtered out)
      expect(result.service).toBeUndefined();
      expect(result.component).toBe('valid-component');
    });

    test('should validate spanContext separately', () => {
      const validSpanContext: SpanContext = {
        traceId: '1234567890abcdef',
        spanId: 'abcdef1234567890',
        traceFlags: '01',
        traceState: 'vendor=test',
      };

      const metadata = {
        service: 'test-service',
        spanContext: validSpanContext,
      };

      const result = validateServiceMetadata(metadata);
      expect(result.spanContext).toEqual(validSpanContext);
    });

    test('should reject invalid spanContext with empty traceId', () => {
      const invalidSpanContext = {
        traceId: '',
        spanId: 'valid-span',
      };

      const metadata = {
        service: 'test-service',
        spanContext: invalidSpanContext,
      };

      const result = validateServiceMetadata(metadata);
      expect(result.spanContext).toBeUndefined();
    });

    test('should reject invalid spanContext with empty spanId', () => {
      const invalidSpanContext = {
        traceId: 'valid-trace',
        spanId: '',
      };

      const metadata = {
        service: 'test-service',
        spanContext: invalidSpanContext,
      };

      const result = validateServiceMetadata(metadata);
      expect(result.spanContext).toBeUndefined();
    });

    test('should limit number of fields', () => {
      const largeMetadata: Record<string, string> = {};
      for (
        let i = 0;
        i < VALIDATION_LIMITS.MAX_CONTEXT_FIELDS + FIELD_LIMIT_BUFFER;
        i++
      ) {
        largeMetadata[`field${i}`] = `value${i}`;
      }

      const result = validateServiceMetadata(largeMetadata);
      const fieldCount = Object.keys(result).length;
      expect(fieldCount).toBeLessThanOrEqual(
        VALIDATION_LIMITS.MAX_CONTEXT_FIELDS,
      );
    });

    test('should filter out dangerous keys', () => {
      const dangerousMetadata = {
        service: 'test-service',
        __proto__: { malicious: true },
        constructor: 'evil',
        prototype: 'bad',
        '123': 'numeric-key',
        validKey: 'valid-value',
      };

      const result = validateServiceMetadata(dangerousMetadata);
      // __proto__, constructor, prototype should be filtered out as dangerous keys
      expect(Object.hasOwn(result, '__proto__')).toBe(false);
      expect(Object.hasOwn(result, 'constructor')).toBe(false);
      expect(Object.hasOwn(result, 'prototype')).toBe(false);
      expect(Object.hasOwn(result, '123')).toBe(false);
      expect(result.service).toBe('test-service');
      expect(result.validKey).toBe('valid-value');
    });

    test('should sanitize complex values', () => {
      const metadata = {
        service: 'test-service',
        arrayField: [...TEST_ARRAY_1_2_3, 'string', { nested: true }],
        objectField: { key: 'value', nested: { deep: 'data' } },
        functionField: () => 'function',
        symbolField: Symbol('test'),
      };

      const result = validateServiceMetadata(metadata);
      expect(result.service).toBe('test-service');
      expect(Array.isArray(result.arrayField)).toBe(true);
      expect(typeof result.objectField).toBe('object');
      expect(typeof result.functionField).toBe('string');
      expect(typeof result.symbolField).toBe('string');
    });

    test('should handle metadata with only spanContext', () => {
      const metadata = {
        spanContext: {
          traceId: '1234567890abcdef',
          spanId: 'abcdef1234567890',
        },
      };

      const result = validateServiceMetadata(metadata);
      expect(result.spanContext).toBeDefined();
      expect(result.spanContext?.traceId).toBe('1234567890abcdef');
    });

    test('should handle optional spanContext fields', () => {
      const metadata = {
        service: 'test-service',
        spanContext: {
          traceId: '1234567890abcdef',
          spanId: 'abcdef1234567890',
          // Optional fields not provided
        },
      };

      const result = validateServiceMetadata(metadata);
      expect(result.spanContext).toBeDefined();
      expect(result.spanContext?.traceFlags).toBeUndefined();
      expect(result.spanContext?.traceState).toBeUndefined();
    });

    test('should handle arrays in metadata', () => {
      const metadata = {
        service: 'test-service',
        tags: ['tag1', 'tag2', 'tag3'],
      };

      const result = validateServiceMetadata(metadata);
      expect(result.service).toBe('test-service');
      expect(Array.isArray(result.tags)).toBe(true);
    });
  });

  describe('isValidLogger', () => {
    test('should validate a proper Pino logger', () => {
      const validLogger = pino({
        level: 'info',
      });

      expect(isValidLogger(validLogger)).toBe(true);
    });

    test('should reject null or undefined', () => {
      expect(isValidLogger(null)).toBe(false);
      expect(isValidLogger(undefined)).toBe(false);
    });

    test('should reject non-objects', () => {
      expect(isValidLogger('string')).toBe(false);
      expect(isValidLogger(TEST_NUMBER + TEST_NUMBER_OFFSET)).toBe(false);
      expect(isValidLogger(true)).toBe(false);
    });

    test('should reject objects missing required methods', () => {
      const incompleteLogger = {
        info: () => {},
        error: () => {},
        // Missing warn, debug, child methods
      };

      expect(isValidLogger(incompleteLogger)).toBe(false);
    });

    test('should reject objects with non-function methods', () => {
      const invalidLogger = {
        info: 'not a function',
        error: () => {},
        warn: () => {},
        debug: () => {},
        child: () => {},
        level: 'info',
      };

      expect(isValidLogger(invalidLogger)).toBe(false);
    });

    test('should reject objects missing level property', () => {
      const loggerWithoutLevel = {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        child: () => {},
        // Missing level property
      };

      expect(isValidLogger(loggerWithoutLevel)).toBe(false);
    });

    test('should validate logger with all required methods', () => {
      const validLogger = {
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {},
        child: () => {},
        level: 'info',
      };

      expect(isValidLogger(validLogger)).toBe(true);
    });
  });

  describe('validateAndCastLogger', () => {
    test('should cast valid Pino logger', () => {
      const validLogger = pino({
        level: 'info',
      });

      const castedLogger = validateAndCastLogger(validLogger);

      // Verify the logger has all required Pino methods
      expect(typeof castedLogger.info).toBe('function');
      expect(typeof castedLogger.error).toBe('function');
      expect(typeof castedLogger.warn).toBe('function');
      expect(typeof castedLogger.debug).toBe('function');
      expect(typeof castedLogger.child).toBe('function');
      expect(castedLogger.level).toBeDefined();
    });

    test('should throw for invalid logger', () => {
      const invalidLogger = {
        info: 'not a function',
      };

      expect(() => {
        validateAndCastLogger(invalidLogger as unknown as pino.Logger);
      }).toThrow('Invalid logger: missing required methods or properties');
    });

    test('should throw for null logger', () => {
      expect(() => {
        validateAndCastLogger(null as unknown as pino.Logger);
      }).toThrow('Invalid logger: missing required methods or properties');
    });
  });

  describe('getApproximateSize', () => {
    test('should return 0 for null and undefined', () => {
      expect(getApproximateSize(null)).toBe(0);
      expect(getApproximateSize(undefined)).toBe(0);
    });

    test('should calculate string size approximately', () => {
      const testString = 'hello';
      const size = getApproximateSize(testString);
      expect(size).toBe(testString.length * UTF16_CHAR_SIZE); // UTF-16 encoding approximation
    });

    test('should calculate number and boolean sizes', () => {
      expect(getApproximateSize(TEST_NUMBER)).toBe(PRIMITIVE_SIZE);
      expect(getApproximateSize(true)).toBe(PRIMITIVE_SIZE);
      expect(getApproximateSize(false)).toBe(PRIMITIVE_SIZE);
    });

    test('should calculate array sizes recursively', () => {
      const testArray = ['hello', TEST_NUMBER, true];
      const size = getApproximateSize(testArray);

      const expectedSize =
        'hello'.length * UTF16_CHAR_SIZE + // string
        PRIMITIVE_SIZE + // number
        PRIMITIVE_SIZE; // boolean

      expect(size).toBe(expectedSize);
    });

    test('should calculate object sizes recursively', () => {
      const testObject = {
        name: 'test',
        count: 5,
        active: true,
      };

      const size = getApproximateSize(testObject);

      const expectedSize =
        'name'.length * UTF16_CHAR_SIZE +
        'test'.length * UTF16_CHAR_SIZE + // key + value
        'count'.length * UTF16_CHAR_SIZE +
        PRIMITIVE_SIZE + // key + number
        'active'.length * UTF16_CHAR_SIZE +
        PRIMITIVE_SIZE; // key + boolean

      expect(size).toBe(expectedSize);
    });

    test('should handle nested objects', () => {
      const nestedObject = {
        level1: {
          level2: {
            value: 'deep',
          },
        },
      };

      const size = getApproximateSize(nestedObject);
      expect(size).toBeGreaterThan(0);
    });

    test('should handle large objects', () => {
      const largeObject: Record<string, string> = {};
      for (let i = 0; i < LOOP_COUNT_LARGE; i++) {
        largeObject[`key${i}`] = `value${i}`;
      }

      const size = getApproximateSize(largeObject);
      expect(size).toBeGreaterThan(SIZE_THRESHOLD_LARGE);
    });

    test('should handle circular references gracefully', () => {
      const circularObject: Record<string, unknown> = { name: 'circular' };
      circularObject['self'] = circularObject;

      expect(() => {
        const size = getApproximateSize(circularObject);
        expect(size).toBeGreaterThan(0);
      }).not.toThrow();
    });

    test('should handle empty arrays', () => {
      expect(getApproximateSize([])).toBe(0);
    });

    test('should handle empty objects', () => {
      expect(getApproximateSize({})).toBe(0);
    });

    test('should handle empty strings', () => {
      expect(getApproximateSize('')).toBe(0);
    });

    test('should handle special number values', () => {
      expect(getApproximateSize(Infinity)).toBe(PRIMITIVE_SIZE);
      expect(getApproximateSize(-Infinity)).toBe(PRIMITIVE_SIZE);
      expect(getApproximateSize(NaN)).toBe(PRIMITIVE_SIZE);
    });
  });

  describe('isWithinSizeLimit', () => {
    test('should return true for small objects', () => {
      const smallObject = {
        name: 'test',
        value: TEST_NUMBER,
      };

      expect(isWithinSizeLimit(smallObject)).toBe(true);
    });

    test('should return true for null and undefined', () => {
      expect(isWithinSizeLimit(null)).toBe(true);
      expect(isWithinSizeLimit(undefined)).toBe(true);
    });

    test('should return false for very large objects', () => {
      // Create an object that exceeds the size limit
      const largeString = 'x'.repeat(
        VALIDATION_LIMITS.MAX_META_SIZE / SIZE_DIVISOR_HALF +
          SIZE_THRESHOLD_LARGE,
      );
      const largeObject = {
        data1: largeString,
        data2: largeString,
      };

      expect(isWithinSizeLimit(largeObject)).toBe(false);
    });

    test('should handle edge case at size limit boundary', () => {
      // Create an object that's exactly at the limit
      const limitString = 'x'.repeat(
        VALIDATION_LIMITS.MAX_META_SIZE / SIZE_DIVISOR_QUARTER,
      );
      const limitObject = {
        data1: limitString,
        data2: limitString,
      };

      // This might be true or false depending on exact calculation,
      // but should not throw an error
      expect(() => {
        isWithinSizeLimit(limitObject);
      }).not.toThrow();
    });

    test('should handle circular references gracefully', () => {
      const circularObject: Record<string, unknown> = { name: 'circular' };
      circularObject['self'] = circularObject;

      // Should not throw an error due to circular reference
      expect(() => {
        isWithinSizeLimit(circularObject);
      }).not.toThrow();
    });

    test('should return true for empty objects', () => {
      expect(isWithinSizeLimit({})).toBe(true);
    });

    test('should return true for small arrays', () => {
      const smallArray = TEST_ARRAY_1_2_3_4_5;
      expect(isWithinSizeLimit(smallArray)).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle extremely large inputs gracefully', () => {
      const extremelyLargeArray = new Array(LARGE_ARRAY_SIZE).fill(
        'large string data',
      );

      expect(() => {
        validateMessage(extremelyLargeArray);
        getApproximateSize(extremelyLargeArray);
        isWithinSizeLimit(extremelyLargeArray);
      }).not.toThrow();
    });

    test('should handle special JavaScript values', () => {
      const specialValues = [
        Infinity,
        -Infinity,
        NaN,
        Symbol('test'),
        new Date(),
        /test/,
        new Error('test error'),
      ];

      for (const value of specialValues) {
        expect(() => {
          validateMessage(value);
          validateServiceMetadata({ special: value });
          getApproximateSize(value);
          isWithinSizeLimit(value);
        }).not.toThrow();
      }
    });

    test('should handle deeply nested objects', () => {
      let deepObject: Record<string, unknown> = { value: 'leaf' };
      for (let i = 0; i < LOOP_COUNT_LARGE; i++) {
        deepObject = { nested: deepObject };
      }

      expect(() => {
        validateServiceMetadata(deepObject);
        getApproximateSize(deepObject);
        isWithinSizeLimit(deepObject);
      }).not.toThrow();
    });

    test('should handle objects with many properties', () => {
      const wideObject: Record<string, string> = {};
      for (let i = 0; i < LOOP_COUNT_WIDE; i++) {
        wideObject[`prop${i}`] = `value${i}`;
      }

      expect(() => {
        const validated = validateServiceMetadata(wideObject);
        // Should have limited the number of properties
        expect(Object.keys(validated).length).toBeLessThanOrEqual(
          VALIDATION_LIMITS.MAX_CONTEXT_FIELDS,
        );
      }).not.toThrow();
    });

    test('should handle performance with large validation operations', () => {
      const startTime = Date.now();

      // Perform many validation operations
      for (let i = 0; i < LOOP_COUNT_WIDE; i++) {
        validateMessage(`Test message ${i}`);
        validateServiceMetadata({
          service: `service-${i}`,
          component: `component-${i}`,
          operation: `operation-${i}`,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(PERF_TEST_TIMEOUT_MS);
    });
  });
});
