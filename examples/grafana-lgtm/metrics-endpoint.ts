/**
 * @fileoverview Prometheus metrics endpoint example
 *
 * Exposes log metrics in Prometheus format for scraping.
 * Includes counters for log levels, services, and error types.
 */

import { DEFAULT_LOG_LEVEL, initLogger } from '@mrstern/logger';
import {
  createMetricsMiddleware,
  withMetrics,
} from '@mrstern/logger/utils/metrics';
import { Hono } from 'hono';

const app = new Hono();

/**
 * Initialize logger with metrics tracking
 */
async function setupLoggerWithMetrics() {
  const baseLogger = await initLogger({
    level: process.env['LOG_LEVEL'] ?? DEFAULT_LOG_LEVEL,
    defaultService: process.env['SERVICE_NAME'] ?? 'api',
  });

  // Wrap logger to automatically track metrics
  return withMetrics(baseLogger, 'api');
}

/**
 * Setup application
 */
async function main() {
  const logger = await setupLoggerWithMetrics();

  // Example API endpoint
  app.get('/api/users/:id', async (c) => {
    const userId = c.req.param('id');
    const requestLogger = logger.child({
      requestId: c.req.header('x-request-id'),
      userId,
    });

    requestLogger.info('Fetching user');

    try {
      // Simulate user fetch
      const user = { id: userId, name: 'John Doe' };
      requestLogger.info({ userId }, 'User fetched successfully');
      return c.json(user);
    } catch (err) {
      // Error counter automatically incremented
      requestLogger.error({ err, userId }, 'Failed to fetch user');
      return c.json({ error: 'User not found' }, 404);
    }
  });

  // Prometheus metrics endpoint
  app.get('/metrics', createMetricsMiddleware());

  return app;
}

/**
 * Metrics output format:
 *
 * # HELP log_level_total Total number of logs by level
 * # TYPE log_level_total counter
 * log_level_total{level="info"} 1234
 * log_level_total{level="error"} 56
 *
 * # HELP log_service_level_total Total number of logs by service and level
 * # TYPE log_service_level_total counter
 * log_service_level_total{service="api",level="info"} 1234
 * log_service_level_total{service="api",level="error"} 56
 *
 * # HELP log_errors_total Total number of errors by type
 * # TYPE log_errors_total counter
 * log_errors_total{service="api",error_type="ValidationError"} 12
 * log_errors_total{service="api",error_type="NetworkError"} 8
 */

/**
 * Prometheus scrape configuration
 *
 * Add this to your prometheus.yml:
 *
 * scrape_configs:
 *   - job_name: 'stern-logger-metrics'
 *     scrape_interval: 15s
 *     static_configs:
 *       - targets: ['localhost:3000']
 *     metrics_path: '/metrics'
 */

/**
 * Example Grafana dashboard queries
 *
 * 1. Log rate by level:
 *    rate(log_level_total[5m])
 *
 * 2. Error rate:
 *    rate(log_level_total{level="error"}[5m])
 *
 * 3. Error rate by service:
 *    sum(rate(log_service_level_total{level="error"}[5m])) by (service)
 *
 * 4. Top error types:
 *    topk(10, sum(rate(log_errors_total[5m])) by (error_type))
 *
 * 5. Error percentage:
 *    sum(rate(log_level_total{level="error"}[5m]))
 *    /
 *    sum(rate(log_level_total[5m]))
 *    * 100
 */

main().catch(console.error);

export default app;
