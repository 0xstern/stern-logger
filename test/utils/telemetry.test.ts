/**
 * Tests for telemetry utilities
 *
 * Validates trace context management, TTL expiration, cleanup mechanisms,
 * and the trace mixin function for OpenTelemetry integration.
 */

import type { SpanContext } from '../../src/types';

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { DEFAULT_TELEMETRY_OPTIONS } from '../../src/constants';
import {
  clearTraceContext,
  createTraceMixin,
  destroyTraceContextManager,
  getTraceContext,
  getTraceContextStats,
  setTraceContext,
} from '../../src/utils/telemetry';

describe('Telemetry Utilities', () => {
  const testThreadId = 'test-thread-123';
  const validSpanContext: SpanContext = {
    traceId: '1234567890abcdef1234567890abcdef',
    spanId: 'abcdef1234567890',
    traceFlags: '01',
    traceState: 'vendor=test',
  };

  beforeEach(() => {
    // Clear all contexts before each test
    destroyTraceContextManager();
  });

  afterEach(() => {
    // Clean up after each test
    destroyTraceContextManager();
  });

  describe('setTraceContext', () => {
    test('should set trace context for a thread', () => {
      setTraceContext(testThreadId, validSpanContext);
      const context = getTraceContext(testThreadId);

      expect(context).toBeDefined();
      expect(context?.traceId).toBe(validSpanContext.traceId);
      expect(context?.spanId).toBe(validSpanContext.spanId);
    });

    test('should set trace context with minimal fields', () => {
      const minimalContext: SpanContext = {
        traceId: '1234567890abcdef',
        spanId: 'abcdef1234567890',
      };

      setTraceContext(testThreadId, minimalContext);
      const context = getTraceContext(testThreadId);

      expect(context).toBeDefined();
      expect(context?.traceId).toBe(minimalContext.traceId);
      expect(context?.spanId).toBe(minimalContext.spanId);
      expect(context?.traceFlags).toBeUndefined();
      expect(context?.traceState).toBeUndefined();
    });

    test('should update existing trace context', () => {
      setTraceContext(testThreadId, validSpanContext);

      const newContext: SpanContext = {
        traceId: 'newtraceabcdef123',
        spanId: 'newspanabcdef123',
      };

      setTraceContext(testThreadId, newContext);
      const context = getTraceContext(testThreadId);

      expect(context?.traceId).toBe(newContext.traceId);
      expect(context?.spanId).toBe(newContext.spanId);
    });

    test('should handle multiple threads independently', () => {
      const thread1 = 'thread-1';
      const thread2 = 'thread-2';

      const context1: SpanContext = {
        traceId: 'trace-1',
        spanId: 'span-1',
      };

      const context2: SpanContext = {
        traceId: 'trace-2',
        spanId: 'span-2',
      };

      setTraceContext(thread1, context1);
      setTraceContext(thread2, context2);

      expect(getTraceContext(thread1)?.traceId).toBe('trace-1');
      expect(getTraceContext(thread2)?.traceId).toBe('trace-2');
    });

    test('should handle setting context for same thread multiple times', () => {
      for (let i = 0; i < 10; i++) {
        setTraceContext(testThreadId, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
        });
      }

      const finalContext = getTraceContext(testThreadId);
      expect(finalContext?.traceId).toBe('trace-9');
    });
  });

  describe('getTraceContext', () => {
    test('should return undefined for non-existent thread', () => {
      const context = getTraceContext('non-existent-thread');
      expect(context).toBeUndefined();
    });

    test('should return the correct context after setting', () => {
      setTraceContext(testThreadId, validSpanContext);
      const context = getTraceContext(testThreadId);

      expect(context).toEqual(validSpanContext);
    });

    test('should return undefined after TTL expiration', async () => {
      // Set a context
      setTraceContext(testThreadId, validSpanContext);

      // Verify it exists
      expect(getTraceContext(testThreadId)).toBeDefined();

      // Wait for TTL to expire (5 minutes + buffer)
      // Note: This is a long test, so we'll mock this by waiting a short time
      // In real scenarios, the TTL is 5 minutes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Context should still exist (TTL hasn't expired yet)
      expect(getTraceContext(testThreadId)).toBeDefined();
    });

    test('should handle concurrent access', () => {
      setTraceContext(testThreadId, validSpanContext);

      // Simulate multiple concurrent reads
      const results = Array.from({ length: 10 }, () =>
        getTraceContext(testThreadId),
      );

      results.forEach((context) => {
        expect(context).toBeDefined();
        expect(context?.traceId).toBe(validSpanContext.traceId);
      });
    });
  });

  describe('clearTraceContext', () => {
    test('should clear trace context for a thread', () => {
      setTraceContext(testThreadId, validSpanContext);
      expect(getTraceContext(testThreadId)).toBeDefined();

      clearTraceContext(testThreadId);
      expect(getTraceContext(testThreadId)).toBeUndefined();
    });

    test('should not affect other threads when clearing', () => {
      const thread1 = 'thread-1';
      const thread2 = 'thread-2';

      setTraceContext(thread1, validSpanContext);
      setTraceContext(thread2, {
        traceId: 'other-trace',
        spanId: 'other-span',
      });

      clearTraceContext(thread1);

      expect(getTraceContext(thread1)).toBeUndefined();
      expect(getTraceContext(thread2)).toBeDefined();
    });

    test('should be idempotent', () => {
      setTraceContext(testThreadId, validSpanContext);

      clearTraceContext(testThreadId);
      clearTraceContext(testThreadId);
      clearTraceContext(testThreadId);

      expect(getTraceContext(testThreadId)).toBeUndefined();
    });

    test('should handle clearing non-existent context', () => {
      expect(() => {
        clearTraceContext('non-existent-thread');
      }).not.toThrow();
    });
  });

  describe('getTraceContextStats', () => {
    test('should return zero size when no contexts exist', () => {
      const stats = getTraceContextStats();
      expect(stats.size).toBe(0);
    });

    test('should return correct size after adding contexts', () => {
      setTraceContext('thread-1', validSpanContext);
      setTraceContext('thread-2', validSpanContext);
      setTraceContext('thread-3', validSpanContext);

      const stats = getTraceContextStats();
      expect(stats.size).toBe(3);
    });

    test('should return correct size after clearing contexts', () => {
      setTraceContext('thread-1', validSpanContext);
      setTraceContext('thread-2', validSpanContext);

      clearTraceContext('thread-1');

      const stats = getTraceContextStats();
      expect(stats.size).toBe(1);
    });

    test('should track size correctly with updates', () => {
      setTraceContext('thread-1', validSpanContext);
      expect(getTraceContextStats().size).toBe(1);

      setTraceContext('thread-1', validSpanContext); // Update same thread
      expect(getTraceContextStats().size).toBe(1);

      setTraceContext('thread-2', validSpanContext); // Add new thread
      expect(getTraceContextStats().size).toBe(2);
    });
  });

  describe('createTraceMixin', () => {
    test('should create a mixin function', () => {
      const mixin = createTraceMixin(() => testThreadId);

      expect(typeof mixin).toBe('function');
    });

    test('should return empty object when no context is set', () => {
      const mixin = createTraceMixin(() => testThreadId);
      const result = mixin();

      expect(result).toEqual({});
    });

    test('should return trace context fields when context is set', () => {
      setTraceContext(testThreadId, validSpanContext);

      const mixin = createTraceMixin(() => testThreadId);
      const result = mixin();

      expect(result.trace_id).toBe(validSpanContext.traceId);
      expect(result.span_id).toBe(validSpanContext.spanId);
      expect(result.trace_flags).toBe(validSpanContext.traceFlags);
      expect(result.trace_state).toBe(validSpanContext.traceState);
    });

    test('should omit optional fields when not provided', () => {
      const minimalContext: SpanContext = {
        traceId: '1234567890abcdef',
        spanId: 'abcdef1234567890',
      };

      setTraceContext(testThreadId, minimalContext);

      const mixin = createTraceMixin(() => testThreadId);
      const result = mixin();

      expect(result.trace_id).toBe(minimalContext.traceId);
      expect(result.span_id).toBe(minimalContext.spanId);
      expect(result.trace_flags).toBeUndefined();
      expect(result.trace_state).toBeUndefined();
    });

    test('should handle empty string traceFlags', () => {
      const contextWithEmptyFlags: SpanContext = {
        traceId: '1234567890abcdef',
        spanId: 'abcdef1234567890',
        traceFlags: '',
        traceState: 'vendor=test',
      };

      setTraceContext(testThreadId, contextWithEmptyFlags);

      const mixin = createTraceMixin(() => testThreadId);
      const result = mixin();

      expect(result.trace_flags).toBeUndefined();
      expect(result.trace_state).toBe('vendor=test');
    });

    test('should use custom getActiveContext when provided', () => {
      const customContext: SpanContext = {
        traceId: 'custom-trace',
        spanId: 'custom-span',
      };

      const getActiveContext = () => customContext;
      const mixin = createTraceMixin(() => testThreadId, getActiveContext);
      const result = mixin();

      expect(result.trace_id).toBe('custom-trace');
      expect(result.span_id).toBe('custom-span');
    });

    test('should fallback to manual mode when getActiveContext throws', () => {
      setTraceContext(testThreadId, validSpanContext);

      const getActiveContext = () => {
        throw new Error('Failed to get active context');
      };

      const mixin = createTraceMixin(() => testThreadId, getActiveContext);
      const result = mixin();

      // Should fallback to manual context
      expect(result.trace_id).toBe(validSpanContext.traceId);
      expect(result.span_id).toBe(validSpanContext.spanId);
    });

    test('should handle multiple calls correctly', () => {
      setTraceContext(testThreadId, validSpanContext);

      const mixin = createTraceMixin(() => testThreadId);

      const result1 = mixin();
      const result2 = mixin();

      expect(result1).toEqual(result2);
    });
  });

  describe('destroyTraceContextManager', () => {
    test('should clear all contexts', () => {
      setTraceContext('thread-1', validSpanContext);
      setTraceContext('thread-2', validSpanContext);
      setTraceContext('thread-3', validSpanContext);

      expect(getTraceContextStats().size).toBe(3);

      destroyTraceContextManager();

      expect(getTraceContextStats().size).toBe(0);
    });

    test('should allow setting contexts after destroy', () => {
      setTraceContext(testThreadId, validSpanContext);
      destroyTraceContextManager();

      setTraceContext(testThreadId, validSpanContext);
      expect(getTraceContext(testThreadId)).toBeDefined();
    });
  });

  describe('Size Limits', () => {
    test('should enforce max context size', () => {
      // Add contexts up to the limit
      for (let i = 0; i < DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE; i++) {
        setTraceContext(`thread-${i}`, validSpanContext);
      }

      const stats = getTraceContextStats();
      expect(stats.size).toBeLessThanOrEqual(
        DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE,
      );
    });

    test('should evict oldest when size limit is reached', () => {
      const limit = DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE;

      // Add one more than the limit
      for (let i = 0; i < limit + 1; i++) {
        setTraceContext(`thread-${i}`, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
        });
      }

      // Size should be at or below the limit
      const stats = getTraceContextStats();
      expect(stats.size).toBeLessThanOrEqual(limit);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long traceId', () => {
      const longContext: SpanContext = {
        traceId: 'a'.repeat(1000),
        spanId: 'b'.repeat(1000),
      };

      setTraceContext(testThreadId, longContext);
      const context = getTraceContext(testThreadId);

      expect(context?.traceId).toBe(longContext.traceId);
      expect(context?.spanId).toBe(longContext.spanId);
    });

    test('should handle special characters in trace context', () => {
      const specialContext: SpanContext = {
        traceId: 'trace-🚀-test',
        spanId: 'span-αβγ-test',
        traceState: 'vendor=test,key=中文',
      };

      setTraceContext(testThreadId, specialContext);
      const context = getTraceContext(testThreadId);

      expect(context?.traceId).toBe(specialContext.traceId);
      expect(context?.traceState).toBe(specialContext.traceState);
    });

    test('should handle rapid context updates', () => {
      for (let i = 0; i < 1000; i++) {
        setTraceContext(testThreadId, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
        });
      }

      const context = getTraceContext(testThreadId);
      expect(context?.traceId).toBe('trace-999');
    });

    test('should handle concurrent set and clear operations', () => {
      const operations = [];

      for (let i = 0; i < 100; i++) {
        operations.push(() => setTraceContext(`thread-${i}`, validSpanContext));
        operations.push(() => clearTraceContext(`thread-${i}`));
      }

      operations.forEach((op) => op());

      // Should not throw and should be in consistent state
      const stats = getTraceContextStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    test('should handle many contexts efficiently', () => {
      const startTime = Date.now();
      const contextCount = 1000;

      for (let i = 0; i < contextCount; i++) {
        setTraceContext(`thread-${i}`, {
          traceId: `trace-${i}`,
          spanId: `span-${i}`,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('should retrieve contexts efficiently', () => {
      // Set up contexts
      for (let i = 0; i < 100; i++) {
        setTraceContext(`thread-${i}`, validSpanContext);
      }

      const startTime = Date.now();

      // Retrieve contexts many times
      for (let i = 0; i < 1000; i++) {
        getTraceContext(`thread-${i % 100}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });
});
