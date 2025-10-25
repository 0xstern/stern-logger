/**
 * @fileoverview Loki transport configuration for Grafana Loki integration
 *
 * Provides transport configuration for shipping logs to Grafana Loki
 * with optimal label cardinality and batching for performance.
 */

import type { TransportTargetOptions } from 'pino';

/**
 * Options for Loki transport configuration
 */
export interface LokiTransportOptions {
  /**
   * Loki server endpoint
   * @example 'http://localhost:3100'
   * @example 'https://logs-prod-us-central1.grafana.net'
   */
  host: string;

  /**
   * Authentication credentials for Grafana Cloud or other secured Loki instances
   * Format: 'username:password' for basic auth
   * @example '123456:glc_eyJrIjoiNzg5...'
   */
  basicAuth?: string;

  /**
   * Bearer token for authentication (alternative to basicAuth)
   */
  bearerToken?: string;

  /**
   * Static labels applied to all log entries
   * Keep cardinality low (typically 5-10 labels)
   *
   * @example { level: 'info', service: 'payment-api', env: 'production' }
   */
  labels?: Record<string, string>;

  /**
   * Batch configuration for performance optimization
   */
  batching?: {
    /**
     * Maximum time to wait before sending a batch (milliseconds)
     * @default 5000 (5 seconds)
     */
    interval?: number;

    /**
     * Maximum number of entries per batch
     * @default 1000
     */
    size?: number;
  };

  /**
   * Timeout for HTTP requests to Loki (milliseconds)
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Custom headers to include in requests
   */
  headers?: Record<string, string>;

  /**
   * Silence pino-loki transport errors
   * Useful for development where Loki may not be available
   * @default false
   */
  silenceErrors?: boolean;

  /**
   * Replace timestamp with current time
   * @default false
   */
  replaceTimestamp?: boolean;

  /**
   * Use JSON format for log lines (structured logging)
   * @default true
   */
  json?: boolean;
}

const DEFAULT_BATCH_INTERVAL_MS = 5000;
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Configure authentication headers for Loki transport
 * @param basicAuth - Basic auth credentials
 * @param bearerToken - Bearer token
 * @param headers - Custom headers
 * @returns Configured headers or basic auth
 */
function configureAuth(
  basicAuth?: string,
  bearerToken?: string,
  headers?: Record<string, string>,
): { basicAuth?: string; headers?: Record<string, string> } {
  if (basicAuth != null && basicAuth.length > 0) {
    return { basicAuth };
  }

  if (bearerToken != null && bearerToken.length > 0) {
    return {
      headers: {
        ...(headers ?? {}),
        Authorization: `Bearer ${bearerToken}`,
      },
    };
  }

  if (headers != null) {
    return { headers };
  }

  return {};
}

/**
 * Configure batching options for Loki transport
 * @param batching - Batching configuration
 * @param batching.interval - Batch interval in milliseconds
 * @param batching.size - Maximum batch size
 * @returns Batching options for pino-loki
 */
function configureBatching(batching?: {
  interval?: number;
  size?: number;
}): Record<string, unknown> {
  if (batching == null) {
    return {};
  }

  return {
    batching: true,
    interval: batching.interval ?? DEFAULT_BATCH_INTERVAL_MS,
    batchSize: batching.size ?? DEFAULT_BATCH_SIZE,
  };
}

/**
 * Creates Pino transport configuration for Loki
 *
 * Optimized for Grafana Loki with:
 * - Low-cardinality labels for efficient indexing
 * - Batching for performance (reduces HTTP overhead)
 * - Structured JSON logging for rich querying
 * - Proper error handling for production resilience
 *
 * @param options - Loki transport configuration
 * @returns Pino transport target options for pino-loki
 *
 * @example
 * ```typescript
 * import { initLogger } from '@mrstern/logger';
 * import { createLokiTransport } from '@mrstern/logger/transports/loki';
 *
 * const logger = await initLogger({
 *   level: 'info',
 *   lokiTransport: createLokiTransport({
 *     host: 'http://localhost:3100',
 *     labels: {
 *       service: 'payment-api',
 *       env: 'production',
 *     },
 *     batching: {
 *       interval: 5000,
 *       size: 1000,
 *     },
 *   }),
 * });
 * ```
 *
 * @example Grafana Cloud configuration
 * ```typescript
 * const lokiTransport = createLokiTransport({
 *   host: 'https://logs-prod-us-central1.grafana.net',
 *   basicAuth: '123456:glc_eyJrIjoiNzg5...',
 *   labels: {
 *     service: 'my-service',
 *     env: 'production',
 *   },
 * });
 * ```
 */
export function createLokiTransport(
  options: LokiTransportOptions,
): TransportTargetOptions {
  const {
    host,
    basicAuth,
    bearerToken,
    labels = {},
    batching,
    timeout = DEFAULT_TIMEOUT_MS,
    headers,
    silenceErrors = false,
    replaceTimestamp = false,
    json = true,
  } = options;

  // Validate required options
  if (!host || host.length === 0) {
    throw new Error('Loki host is required');
  }

  // Build transport options
  const transportOptions: Record<string, unknown> = {
    host,
    labels,
    json,
    timeout,
    silenceErrors,
    replaceTimestamp,
    ...configureAuth(basicAuth, bearerToken, headers),
    ...configureBatching(batching),
  };

  return {
    target: 'pino-loki',
    level: 'trace', // Let Loki filter by level via labels
    options: transportOptions,
  };
}

/**
 * Best practices for Loki label design:
 *
 * 1. **Low Cardinality** - Keep unique label combinations under 10k
 *    - Good: level, service, env, host, region
 *    - Bad: user_id, request_id, trace_id (use log payload instead)
 *
 * 2. **Static Labels** - Labels should be relatively static
 *    - Avoid dynamic values that change per request
 *    - Use child loggers for request-scoped context
 *
 * 3. **Hierarchical Organization** - Structure labels for drilling down
 *    - env → service → component → host
 *
 * 4. **Common Label Sets** - Reuse label combinations
 *    - Reduces storage and improves query performance
 *
 * 5. **Trace Correlation** - Use log payload, not labels
 *    - trace_id and span_id belong in the log message
 *    - Tempo correlates via these fields automatically
 *
 * @example Optimal label structure
 * ```typescript
 * {
 *   level: 'info',          // 6 values: trace, debug, info, warn, error, fatal
 *   service: 'payment-api', // ~10-100 services in your org
 *   env: 'production',      // 3-5 environments: dev, staging, prod
 *   region: 'us-east-1',    // ~5-20 regions
 *   host: 'server-01',      // ~100-1000 hosts
 * }
 * // Total combinations: 6 * 100 * 5 * 20 * 1000 = 60M (acceptable if spread over time)
 * // Active combinations: ~6 * 100 * 5 * 20 * 10 = 60k (good)
 * ```
 *
 * @example Bad label structure (high cardinality)
 * ```typescript
 * {
 *   user_id: '12345',        // Millions of users = explosion
 *   request_id: 'req-abc',   // Every request unique = disaster
 *   timestamp: '2024-01-01', // Infinite growth
 * }
 * ```
 */
