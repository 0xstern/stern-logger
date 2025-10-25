/**
 * @fileoverview Backend logger configuration for Grafana LGTM stack
 *
 * Example configuration showing optimal setup for:
 * - Loki (logs)
 * - Tempo (traces via OpenTelemetry)
 * - Prometheus (metrics)
 * - Grafana (visualization)
 */

import {
  DEFAULT_LOG_LEVEL,
  DEFAULT_NODE_ENV,
  initLogger,
} from '@mrstern/logger';
import { createLokiTransport } from '@mrstern/logger/transports/loki';
import { withMetrics } from '@mrstern/logger/utils/metrics';

/**
 * Initialize logger optimized for Grafana LGTM stack
 */
async function setupLogger() {
  const logger = await initLogger({
    level: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL,
    defaultService: process.env['SERVICE_NAME'] ?? 'api',
    nodeEnv: process.env['NODE_ENV'] ?? DEFAULT_NODE_ENV,

    // Enable OpenTelemetry trace context auto-injection
    telemetry: {
      enabled: true,
      autoInject: true, // Automatically inject trace_id and span_id
    },

    // Redact sensitive fields
    redactPaths: [
      'password',
      'token',
      'apiKey',
      'secret',
      'authorization',
      'cookie',
    ],

    // Configure transports
    // Note: In production, you typically want to send logs to Loki, not files
  });

  // Add Loki transport for production
  if (process.env['LOKI_URL']) {
    const lokiLogger = await initLogger({
      level: 'info',
      defaultService: process.env['SERVICE_NAME'] ?? 'api',
      telemetry: { enabled: true, autoInject: true },
      transports: [
        createLokiTransport({
          host: process.env['LOKI_URL'],

          // Low-cardinality labels for efficient indexing
          labels: {
            service: process.env['SERVICE_NAME'] ?? 'api',
            env: process.env['NODE_ENV'] ?? 'production',
            // Add more static labels as needed (keep cardinality low!)
          },

          // Batching for performance
          batching: {
            interval: 5000, // Send batch every 5 seconds
            size: 1000, // Or when 1000 logs accumulated
          },

          // Authentication for Grafana Cloud
          basicAuth: process.env['LOKI_AUTH'], // Format: 'userId:apiKey'

          // Enable JSON structured logging
          json: true,

          // Silence transport errors in production (logs to console instead)
          silenceErrors: false,
        }),
      ],
    });

    return withMetrics(lokiLogger, process.env['SERVICE_NAME']);
  }

  return withMetrics(logger, process.env['SERVICE_NAME']);
}

/**
 * Usage example
 */
async function main() {
  const logger = await setupLogger();

  // Create child logger with additional context
  const requestLogger = logger.child({
    requestId: 'req-123',
    userId: 'user-456',
    component: 'payment',
  });

  // Log with trace context (automatically injected if OpenTelemetry is set up)
  requestLogger.info({ amount: 100, currency: 'USD' }, 'Payment processed');

  // Error logging
  try {
    throw new Error('Payment failed');
  } catch (err) {
    requestLogger.error({ err }, 'Payment processing failed');
  }

  // Logs will include:
  // - trace_id and span_id (from OpenTelemetry)
  // - service, component, requestId, userId (from context)
  // - timestamp, level, msg (standard Pino fields)
}

main().catch(console.error);
