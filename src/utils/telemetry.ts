/**
 * @fileoverview OpenTelemetry trace context management
 *
 * Provides thread-local trace context storage with TTL and size limits,
 * and Pino mixin creation for automatic trace ID injection into logs.
 */

import type { SpanContext } from '../types';

import { DEFAULT_TELEMETRY_OPTIONS } from '../constants';

/**
 * Interface for trace context entries with TTL
 */
interface TraceContextEntry {
  context: SpanContext;
  timestamp: number;
  lastAccessed: number;
}

/**
 * Configuration for trace context storage
 */
interface TraceContextConfig {
  maxSize: number;
  ttlMs: number;
  cleanupIntervalMs: number;
}

/**
 * Default configuration for trace context storage
 */
const DEFAULT_TRACE_CONFIG: TraceContextConfig = {
  maxSize: DEFAULT_TELEMETRY_OPTIONS.MAX_CONTEXT_SIZE,
  ttlMs: DEFAULT_TELEMETRY_OPTIONS.TTL_MS,
  cleanupIntervalMs: DEFAULT_TELEMETRY_OPTIONS.CLEANUP_INTERVAL_MS,
};

/**
 * Thread-local storage for trace context with TTL and size limits
 */
class TraceContextManager {
  private readonly contexts = new Map<string, TraceContextEntry>();
  private readonly config: TraceContextConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<TraceContextConfig> = {}) {
    this.config = { ...DEFAULT_TRACE_CONFIG, ...config };
    this.startCleanup();
  }

  /**
   * Set trace context for a thread with TTL
   * @param threadId - Identifier for the current thread/process
   * @param context - OpenTelemetry span context
   */
  public set(threadId: string, context: SpanContext): void {
    const now = Date.now();

    // Check if we need to evict entries due to size limit
    if (this.contexts.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.contexts.set(threadId, {
      context,
      timestamp: now,
      lastAccessed: now,
    });
  }

  /**
   * Get trace context for a thread
   * @param threadId - Identifier for the current thread/process
   * @returns The current trace context, if any
   */
  public get(threadId: string): SpanContext | undefined {
    const entry = this.contexts.get(threadId);
    if (!entry) {
      return undefined;
    }

    const now = Date.now();

    // Check if entry has expired
    if (now - entry.timestamp > this.config.ttlMs) {
      this.contexts.delete(threadId);
      return undefined;
    }

    // Update last accessed time
    entry.lastAccessed = now;
    return entry.context;
  }

  /**
   * Clear trace context for a thread
   * @param threadId - Identifier for the current thread/process
   */
  public clear(threadId: string): void {
    this.contexts.delete(threadId);
  }

  /**
   * Clear all contexts
   */
  public clearAll(): void {
    this.contexts.clear();
  }

  /**
   * Get current size of context storage
   * @returns Number of stored trace contexts
   */
  public size(): number {
    return this.contexts.size;
  }

  /**
   * Evict the oldest entry based on last accessed time
   */
  private evictOldest(): void {
    let oldestKey: string | undefined;
    let oldestTime = Date.now();

    for (const [key, entry] of this.contexts) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey != null) {
      this.contexts.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: Array<string> = [];

    for (const [key, entry] of this.contexts) {
      if (now - entry.timestamp > this.config.ttlMs) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.contexts.delete(key);
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);

    // Don't keep the process alive for cleanup timer
    this.cleanupTimer.unref();
  }

  /**
   * Stop cleanup and clear all contexts
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clearAll();
  }
}

// Global trace context manager instance
const traceContextManager = new TraceContextManager();

/**
 * Set trace context for the current thread/process
 *
 * @param threadId - Identifier for the current thread/process
 * @param context - OpenTelemetry span context
 */
export function setTraceContext(threadId: string, context: SpanContext): void {
  traceContextManager.set(threadId, context);
}

/**
 * Clear trace context for the current thread/process
 *
 * @param threadId - Identifier for the current thread/process
 */
export function clearTraceContext(threadId: string): void {
  traceContextManager.clear(threadId);
}

/**
 * Get trace context for the current thread/process
 *
 * @param threadId - Identifier for the current thread/process
 * @returns The current trace context, if any
 */
export function getTraceContext(threadId: string): SpanContext | undefined {
  return traceContextManager.get(threadId);
}

/**
 * Get statistics about trace context storage
 * @returns Object containing the current size of trace context storage
 */
export function getTraceContextStats(): { size: number } {
  return {
    size: traceContextManager.size(),
  };
}

/**
 * Clean up all trace contexts (useful for testing or shutdown)
 */
export function destroyTraceContextManager(): void {
  traceContextManager.destroy();
}

/**
 * Creates a mixin function for Pino that injects trace context into logs
 *
 * @param getCurrentThreadId - Function to get the current thread ID
 * @param getActiveContext - Optional function to get active context from OpenTelemetry
 * @returns Mixin function for Pino
 */
export function createTraceMixin(
  getCurrentThreadId: () => string,
  getActiveContext?: () => SpanContext | undefined,
): () => Record<string, unknown> {
  return (): Record<string, unknown> => {
    const threadId = getCurrentThreadId();

    // Try to get context from OpenTelemetry first (auto mode)
    let traceContext: SpanContext | undefined;
    if (getActiveContext) {
      try {
        traceContext = getActiveContext();
      } catch {
        // Fallback to manual mode if auto-detection fails
        traceContext = traceContextManager.get(threadId);
      }
    } else {
      // Manual mode - get from our context manager
      traceContext = traceContextManager.get(threadId);
    }

    if (traceContext) {
      return {
        trace_id: traceContext.traceId,
        span_id: traceContext.spanId,
        ...(traceContext.traceFlags != null &&
          traceContext.traceFlags.length > 0 && {
            trace_flags: traceContext.traceFlags,
          }),
        ...(traceContext.traceState != null &&
          traceContext.traceState.length > 0 && {
            trace_state: traceContext.traceState,
          }),
      };
    }

    return {};
  };
}
