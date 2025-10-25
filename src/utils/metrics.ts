/**
 * @fileoverview Prometheus metrics extraction utilities
 *
 * Provides helpers for extracting metrics from structured logs
 * for Prometheus integration and observability dashboards.
 */

import type { Logger } from '../types';

/**
 * Counter for tracking log events by level
 */
export interface LogMetrics {
  /**
   * Total number of logs by level
   */
  readonly counts: Readonly<Record<string, number>>;

  /**
   * Last update timestamp
   */
  readonly lastUpdate: number;
}

/**
 * Log metrics tracker with Prometheus-compatible counters
 */
export class LogMetricsCollector {
  private readonly levelCounts: Map<string, number> = new Map();
  private readonly serviceCounts: Map<string, number> = new Map();
  private readonly errorCounts: Map<string, number> = new Map();
  private lastUpdateTime: number = Date.now();

  /**
   * Increment counter for a specific log level
   * @param level - Log level (info, error, warn, etc.)
   * @param service - Service name (optional)
   */
  public incrementLevel(level: string, service?: string): void {
    // Increment level counter
    const currentCount = this.levelCounts.get(level) ?? 0;
    this.levelCounts.set(level, currentCount + 1);

    // Increment service counter if provided
    if (service != null && service.length > 0) {
      const serviceKey = `${service}:${level}`;
      const serviceCount = this.serviceCounts.get(serviceKey) ?? 0;
      this.serviceCounts.set(serviceKey, serviceCount + 1);
    }

    this.lastUpdateTime = Date.now();
  }

  /**
   * Increment error counter with error type classification
   * @param errorType - Error classification (e.g., 'ValidationError', 'NetworkError')
   * @param service - Service name (optional)
   */
  public incrementError(errorType: string, service?: string): void {
    const errorKey = service != null ? `${service}:${errorType}` : errorType;
    const currentCount = this.errorCounts.get(errorKey) ?? 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastUpdateTime = Date.now();
  }

  /**
   * Get current metrics snapshot
   * @returns Metrics object with counters
   */
  public getMetrics(): LogMetrics {
    return {
      counts: Object.fromEntries(this.levelCounts),
      lastUpdate: this.lastUpdateTime,
    };
  }

  /**
   * Get Prometheus-formatted metrics
   * @returns String in Prometheus exposition format
   *
   * @example
   * ```
   * # HELP log_level_total Total number of logs by level
   * # TYPE log_level_total counter
   * log_level_total{level="info"} 1234
   * log_level_total{level="error"} 56
   * ```
   */
  public getPrometheusMetrics(): string {
    const lines: Array<string> = [];

    // Log level counters
    lines.push('# HELP log_level_total Total number of logs by level');
    lines.push('# TYPE log_level_total counter');
    for (const [level, count] of this.levelCounts.entries()) {
      lines.push(`log_level_total{level="${level}"} ${count}`);
    }

    // Service-level counters
    if (this.serviceCounts.size > 0) {
      lines.push('');
      lines.push(
        '# HELP log_service_level_total Total number of logs by service and level',
      );
      lines.push('# TYPE log_service_level_total counter');
      for (const [key, count] of this.serviceCounts.entries()) {
        const [service, level] = key.split(':');
        lines.push(
          `log_service_level_total{service="${service}",level="${level}"} ${count}`,
        );
      }
    }

    // Error counters
    if (this.errorCounts.size > 0) {
      lines.push('');
      lines.push('# HELP log_errors_total Total number of errors by type');
      lines.push('# TYPE log_errors_total counter');
      const SERVICE_ERROR_PARTS_LENGTH = 2;
      for (const [key, count] of this.errorCounts.entries()) {
        const parts = key.split(':');
        if (parts.length === SERVICE_ERROR_PARTS_LENGTH) {
          const service = parts[0];
          const errorType = parts[1];
          lines.push(
            `log_errors_total{service="${service}",error_type="${errorType}"} ${count}`,
          );
        } else {
          lines.push(`log_errors_total{error_type="${key}"} ${count}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all counters (useful for testing)
   */
  public reset(): void {
    this.levelCounts.clear();
    this.serviceCounts.clear();
    this.errorCounts.clear();
    this.lastUpdateTime = Date.now();
  }

  /**
   * Get counter for specific level
   * @param level - Log level
   * @returns Current count for the level
   */
  public getLevelCount(level: string): number {
    return this.levelCounts.get(level) ?? 0;
  }

  /**
   * Get counter for specific service and level
   * @param service - Service name
   * @param level - Log level
   * @returns Current count for the service and level
   */
  public getServiceLevelCount(service: string, level: string): number {
    const key = `${service}:${level}`;
    return this.serviceCounts.get(key) ?? 0;
  }
}

/**
 * Global metrics collector instance
 */
const globalMetricsCollector = new LogMetricsCollector();

/**
 * Get the global metrics collector
 * @returns Global LogMetricsCollector instance
 */
export function getGlobalMetricsCollector(): LogMetricsCollector {
  return globalMetricsCollector;
}

/**
 * Wraps a logger to automatically track metrics
 *
 * Creates a proxy around the logger that intercepts log calls
 * and increments appropriate counters.
 *
 * @param logger - Logger instance to wrap
 * @param serviceName - Service name for metrics
 * @returns Wrapped logger with metrics tracking
 *
 * @example
 * ```typescript
 * import { baseLogger } from '@mrstern/logger';
 * import { withMetrics } from '@mrstern/logger/utils/metrics';
 *
 * const logger = withMetrics(baseLogger, 'payment-api');
 *
 * // Logs are tracked automatically
 * logger.info('Payment processed'); // Increments info counter
 * logger.error({ err }, 'Payment failed'); // Increments error counter
 * ```
 */
export function withMetrics(logger: Logger, serviceName?: string): Logger {
  const collector = globalMetricsCollector;

  return new Proxy(logger, {
    get(target, prop, receiver): unknown {
      const original: unknown = Reflect.get(target, prop, receiver);

      // Intercept log level methods
      if (
        typeof original === 'function' &&
        typeof prop === 'string' &&
        ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(prop)
      ) {
        return new Proxy(original as (...args: Array<unknown>) => unknown, {
          apply(
            targetFn: (...args: Array<unknown>) => unknown,
            thisArg: unknown,
            argumentsList: Array<unknown>,
          ): unknown {
            // Increment metrics
            collector.incrementLevel(prop, serviceName);

            // If error level, try to extract error type
            if (prop === 'error' && argumentsList.length > 0) {
              const firstArg = argumentsList[0];
              if (
                typeof firstArg === 'object' &&
                firstArg !== null &&
                'err' in firstArg
              ) {
                const err = (firstArg as { err: unknown }).err;
                if (err instanceof Error) {
                  collector.incrementError(err.name, serviceName);
                }
              }
            }

            // Call original function
            return Reflect.apply(targetFn, thisArg, argumentsList);
          },
        });
      }

      return original;
    },
  });
}

/**
 * Creates an Express/Hono middleware for Prometheus metrics endpoint
 *
 * @returns Middleware function that serves Prometheus metrics
 *
 * @example Express
 * ```typescript
 * import express from 'express';
 * import { createMetricsMiddleware } from '@mrstern/logger/utils/metrics';
 *
 * const app = express();
 * app.get('/metrics', createMetricsMiddleware());
 * ```
 *
 * @example Hono
 * ```typescript
 * import { Hono } from 'hono';
 * import { createMetricsMiddleware } from '@mrstern/logger/utils/metrics';
 *
 * const app = new Hono();
 * app.get('/metrics', createMetricsMiddleware());
 * ```
 */
export function createMetricsMiddleware(): (
  req: unknown,
  res: {
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
  },
) => void {
  return (_req: unknown, res) => {
    const metrics = globalMetricsCollector.getPrometheusMetrics();
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.end(metrics);
  };
}
