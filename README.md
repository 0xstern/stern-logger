# Stern Logger

**Structured JSON logging with OpenTelemetry integration, automatic trace correlation, and sensitive data redaction.**

Built on Pino for high performance. Includes file rotation, pretty console output, browser support, and Grafana LGTM stack integration.

<p>
    <a href="https://github.com/0xstern/stern-logger/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xstern/stern-logger/ci.yml?branch=main" alt="Build Status"></a>
    <a href="https://github.com/0xstern/stern-logger/releases"><img src="https://img.shields.io/npm/v/@mrstern/logger.svg" alt="Latest Release"></a>
    <a href="https://github.com/0xstern/stern-logger/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@mrstern/logger.svg" alt="License"></a>
</p>

## Table of Contents

- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Usage](#basic-usage)
  - [Custom Logger](#custom-logger)
  - [Framework Integration](#framework-integration)
- [Configuration](#configuration)
  - [Configuration Sources](#configuration-sources)
  - [Default Constants](#default-constants)
  - [File Rotation](#file-rotation)
  - [Telemetry](#telemetry)
  - [Redaction](#redaction)
  - [Log Formatting](#log-formatting)
- [Advanced Features](#advanced-features)
  - [Distributed Tracing](#distributed-tracing)
  - [LGTM Stack Integration](#lgtm-stack-integration)
  - [Process Handlers](#process-handlers)
  - [Metrics Collection](#metrics-collection)
  - [Browser Logger](#browser-logger)
- [Examples](#examples)
- [API Reference](#api-reference)
- [Requirements](#requirements)
- [Contributing](#contributing)
- [License](#license)
- [Appendix](#appendix)

## Quick Start

**1. Install:**

```bash
npm install @mrstern/logger
```

**2. Use the pre-configured logger:**

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info('Application started');
baseLogger.error({ err: new Error('Connection failed') }, 'Database error');
```

**3. Add context with child loggers:**

```typescript
const userLogger = baseLogger.child({
  component: 'user-service',
  userId: '123',
});

userLogger.info('User created');
userLogger.debug({ email: 'user@example.com' }, 'Sending verification');
```

That's it! The logger is configured with sensible defaults for development.

## Core Concepts

### What It Does

Stern Logger provides:

- **Structured JSON Logging** - Built on Pino for high performance
- **OpenTelemetry Integration** - Automatic trace context correlation
- **Sensitive Data Redaction** - Automatic redaction of passwords, tokens, credentials
- **File Rotation** - Configurable retention policies via pino-roll
- **Error Handling** - Uncaught exception and unhandled rejection handlers
- **Pretty Console Output** - Development-friendly formatting via pino-pretty
- **Browser Support** - Lightweight logger for frontend applications
- **Metrics Collection** - Prometheus-compatible metrics for log monitoring
- **LGTM Stack** - Loki transport for Grafana integration

### Log Structure

All logs follow a consistent JSON structure:

```json
{
  "level": 30,
  "time": 1234567890,
  "service": "api",
  "env": "production",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "msg": "User created",
  "userId": "123",
  "component": "user-service"
}
```

**Log Levels:**

- `fatal` (60) - Application crash
- `error` (50) - Error conditions
- `warn` (40) - Warning conditions
- `info` (30) - Informational messages
- `debug` (20) - Debug messages
- `trace` (10) - Very detailed debug messages

### Generated Files

With file rotation enabled:

```
logs/
├── app.log              # Main application logs
├── app.log.1            # Rotated log files
├── app.log.2
├── exceptions.log       # Uncaught exceptions
└── rejections.log       # Unhandled promise rejections
```

## Installation

```bash
# Bun
bun add @mrstern/logger

# pnpm
pnpm add @mrstern/logger

# Yarn
yarn add @mrstern/logger

# npm
npm install @mrstern/logger
```

## Usage

### Basic Usage

**Pre-configured Logger:**

```typescript
import { baseLogger } from '@mrstern/logger';

// Simple logging
baseLogger.info('Application started');

// With context
baseLogger.error({ userId: '123', code: 'AUTH_001' }, 'Authentication failed');

// Child loggers inherit context
const authLogger = baseLogger.child({ component: 'authentication' });
authLogger.info({ method: 'oauth' }, 'User logged in');
```

**Error Logging:**

```typescript
try {
  await riskyOperation();
} catch (error) {
  baseLogger.error({ err: error, operation: 'payment' }, 'Operation failed');
  // Logs full error with stack trace, cause chain, and custom properties
}
```

### Custom Logger

**Basic Configuration:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  level: 'debug',
  defaultService: 'payment-api',
  logDir: './logs',
});

logger.info('Custom logger initialized');
```

**Full Configuration:**

```typescript
const logger = await initLogger({
  // Required
  level: 'info',
  defaultService: 'payment-api',

  // Optional: File rotation
  logDir: '/var/log/myapp',
  fileRotationOptions: {
    maxSize: '20m',
    maxFiles: 30,
    frequency: 'daily',
  },

  // Optional: OpenTelemetry
  telemetry: {
    enabled: true,
    autoInject: true, // Auto-inject from OpenTelemetry API
  },

  // Optional: Redaction
  redactionOptions: {
    paths: ['payment.cardNumber', 'user.ssn', 'session.token'],
    censor: '[HIDDEN]',
  },

  // Optional: Pretty printing
  prettyPrint: true, // Default: true in development
  formatStyle: 'compact', // 'compact' or 'default'
});
```

### Framework Integration

**Express.js:**

```typescript
import { initLogger } from '@mrstern/logger';
import express from 'express';

const logger = await initLogger({ defaultService: 'express-api' });
const app = express();

// Request logging middleware
app.use((req, res, next) => {
  const requestLogger = logger.child({
    requestId: req.headers['x-request-id'],
    method: req.method,
    path: req.path,
  });

  requestLogger.info('Incoming request');
  next();
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Request failed');
  res.status(500).json({ error: 'Internal server error' });
});
```

**Hono:**

```typescript
import { serve } from '@hono/node-server';
import { initLogger } from '@mrstern/logger';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

const logger = await initLogger({ defaultService: 'hono-api' });
const app = new Hono();

app.use(requestId());

app.use(async (c, next) => {
  const requestLogger = logger.child({
    requestId: c.var.requestId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set('logger', requestLogger);
  requestLogger.info('Request started');

  await next();

  requestLogger.info({ status: c.res.status }, 'Request completed');
});

app.get('/', (c) => {
  c.var.logger.info('Processing request');
  return c.json({ message: 'Hello!' });
});

serve(app);
```

**React:**

```typescript
// LoggerContext.tsx
import { createContext, useContext } from 'react';
import type { Logger } from '@mrstern/logger';

import { baseLogger } from '@mrstern/logger';

const LoggerContext = createContext<Logger>(baseLogger);

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const logger = baseLogger.child({ component: 'react-app' });

  return (
    <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
  );
}

export const useLogger = () => useContext(LoggerContext);
```

```typescript
// Component.tsx
function UserProfile({ userId }: { userId: string }) {
  const logger = useLogger();

  useEffect(() => {
    logger.info({ userId }, 'Loading profile');

    fetchUserProfile(userId)
      .then(() => logger.info({ userId }, 'Profile loaded'))
      .catch((err) => logger.error({ err, userId }, 'Load failed'));
  }, [userId, logger]);

  return <div>User Profile</div>;
}
```

## Configuration

### Configuration Sources

The library provides pure default constants. You control how configuration is loaded.

**Environment Variables:**

```typescript
import { DEFAULT_LOG_LEVEL, initLogger } from '@mrstern/logger';

const logger = await initLogger({
  level: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
  defaultService: process.env.SERVICE_NAME ?? 'app',
  logDir: process.env.LOG_DIR ?? './logs',
  fileRotationOptions: {
    maxSize: process.env.LOG_ROTATION_MAX_SIZE ?? '10m',
    maxFiles: Number(process.env.LOG_ROTATION_MAX_FILES) || 14,
  },
});
```

**Zod Validation:**

```typescript
import { initLogger } from '@mrstern/logger';
import { z } from 'zod';

const envSchema = z.object({
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error'])
    .default('info'),
  SERVICE_NAME: z.string().default('app'),
  LOG_DIR: z.string().default('./logs'),
});

const env = envSchema.parse(process.env);

const logger = await initLogger({
  level: env.LOG_LEVEL,
  defaultService: env.SERVICE_NAME,
  logDir: env.LOG_DIR,
});
```

**AWS Secrets Manager:**

```typescript
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import { initLogger } from '@mrstern/logger';

async function getLoggerConfig() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'prod/logger-config' }),
  );

  return JSON.parse(response.SecretString);
}

const config = await getLoggerConfig();
const logger = await initLogger(config);
```

### Default Constants

Import and use these defaults in your configuration:

```typescript
import {
  DEFAULT_LOG_DIRECTORY, // './logs'
  DEFAULT_LOG_LEVEL, // 'info'
  DEFAULT_NODE_ENV, // 'development'
  DEFAULT_REDACT_PATHS, // ['password', 'token', 'apiKey', ...]
  DEFAULT_ROTATION_OPTIONS, // { MAX_SIZE: '10m', MAX_FILES: 14, FREQUENCY: 'daily' }
  DEFAULT_SERVICE_NAME, // 'app'
  DEFAULT_TELEMETRY_OPTIONS, // { MAX_CONTEXT_SIZE: 10000, TTL_MS: 300000, ... }
} from '@mrstern/logger';
```

### File Rotation

Configure file rotation for log management:

```typescript
const logger = await initLogger({
  logDir: '/var/log/myapp',
  fileRotationOptions: {
    maxSize: '10m', // Rotate when file reaches 10MB
    maxFiles: 14, // Keep last 14 files
    frequency: 'daily', // Rotate daily at midnight
  },
});
```

**Rotation Strategies:**

- **Size-based**: `maxSize: '10m'` - Rotate when file reaches size
- **Time-based**: `frequency: 'daily'` or `frequency: 'hourly'`
- **Retention**: `maxFiles: 14` - Keep last N files, delete older

### Telemetry

OpenTelemetry integration for distributed tracing:

**Manual Context Management:**

```typescript
import { baseLogger } from '@mrstern/logger';

// Set trace context explicitly
baseLogger.setTraceContext({
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  traceFlags: '01',
});

baseLogger.info('Processing request'); // Includes trace_id and span_id

// Clear context when done
baseLogger.clearTraceContext();
```

**Auto-Injection:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  telemetry: {
    enabled: true,
    autoInject: true, // Automatically inject from OpenTelemetry API
  },
});

// Trace context injected automatically when span is active
logger.info('Request processed');
```

### Redaction

Automatically redact sensitive fields from logs:

**Default Redaction:**

```typescript
baseLogger.info({
  username: 'john.doe',
  password: 'secret123', // → '[Redacted]'
  apiKey: 'sk-1234567890', // → '[Redacted]'
  creditCard: '4111-1111-1111-1111', // → '[Redacted]'
});
```

**Default redacted fields:** `password`, `creditCard`, `auth`, `authorization`, `cookie`, `token`, `apiKey`, `secret`, `ssn` (including nested: `*.password`, `user.*.apiKey`)

**Custom Redaction:**

```typescript
const logger = await initLogger({
  redactionOptions: {
    paths: ['payment.cardNumber', 'user.ssn', 'session.token'],
    censor: '[HIDDEN]',
    remove: false, // If true, removes fields instead of censoring
  },
});
```

### Log Formatting

Configure console output format style for development and debugging.

**Compact Format (Default):**

```typescript
const logger = await initLogger({
  prettyPrint: true,
  formatStyle: 'compact', // Default
});

logger.info('Server started');
// Output: 21:44:33 INFO [development] [app] Server started

logger.info({ port: 8080, host: 'localhost' }, 'Listening');
// Output:
// 21:44:33 INFO [development] [app] Listening
//     port: 8080
//     host: "localhost"
```

**Traditional pino-pretty Format:**

```typescript
const logger = await initLogger({
  prettyPrint: true,
  formatStyle: 'default',
});

logger.info('Server started');
// Output: [2025-10-30 21:44:33.456 -0700] INFO: Server started
//     service: "app"
//     env: "development"
```

**Format Comparison:**

- **Compact**: `HH:MM:SS LEVEL [env] [service] message`
  - Concise header line with time-only timestamp
  - Extra fields displayed indented on separate lines
  - Better for development logs with clear context

- **Default**: Traditional pino-pretty with full timestamp
  - Full timestamp with timezone
  - All fields including standard ones shown indented
  - More verbose output for detailed inspection

**Production (No Pretty Printing):**

```typescript
const logger = await initLogger({
  prettyPrint: false, // Structured JSON for production
});

logger.info('Server started');
// Output: {"level":30,"time":1761885873457,"service":"app","env":"production","msg":"Server started"}
```

## Advanced Features

### Distributed Tracing

Full end-to-end tracing from browser through backend services.

**See [Appendix: Distributed Tracing Setup](#distributed-tracing-setup) for complete setup guide.**

**Browser → Backend Trace Propagation:**

```typescript
// Browser side

import { initBrowserLogger } from '@mrstern/logger/browser';

const logger = initBrowserLogger({ service: 'web-app' });

// Set trace context before API call
logger.setTraceContext({
  traceId: generateTraceId(),
  spanId: generateSpanId(),
  traceFlags: '01',
});

// Propagate via W3C traceparent header
const context = logger.getTraceContext();
await fetch('/api/users', {
  headers: {
    traceparent: `00-${context.traceId}-${context.spanId}-01`,
  },
});
```

```typescript
// Backend side (Hono middleware)

import { initLogger } from '@mrstern/logger';

const logger = await initLogger({ telemetry: { enabled: true } });

app.use(async (c, next) => {
  const traceparent = c.req.header('traceparent');
  if (traceparent) {
    const { traceId, spanId } = parseTraceparent(traceparent);
    logger.setTraceContext({ traceId, spanId, traceFlags: '01' });
  }

  await next();
});
```

### LGTM Stack Integration

Integrated support for Grafana's LGTM stack (Loki, Tempo, Grafana, Mimir).

**See [Appendix: LGTM Stack Configuration](#lgtm-stack-configuration) for complete setup guide.**

**Loki Transport:**

```typescript
import { initLogger } from '@mrstern/logger';
import { createLokiTransport } from '@mrstern/logger/transports/loki';

const logger = await initLogger({
  level: 'info',
  defaultService: 'api',
  telemetry: { enabled: true, autoInject: true },
  transports: [
    createLokiTransport({
      host: process.env.LOKI_URL,
      labels: {
        service: 'api',
        env: process.env.NODE_ENV ?? 'production',
      },
      batching: {
        interval: 5000, // Send batch every 5 seconds
        size: 1000, // Or when 1000 logs accumulated
      },
      basicAuth: process.env.LOKI_AUTH, // 'userId:apiKey'
      json: true,
    }),
  ],
});
```

**Metrics Collection:**

```typescript
import { withMetrics } from '@mrstern/logger/utils/metrics';

const logger = await initLogger({ defaultService: 'api' });
const metricsLogger = withMetrics(logger, 'api');

// Metrics automatically tracked
metricsLogger.error({ err: error }, 'Request failed');
// → Increments error counter

// Expose metrics endpoint
app.get('/metrics', createMetricsMiddleware());
```

### Process Handlers

Automatically log uncaught exceptions and unhandled rejections:

```typescript
import { initLogger, registerProcessHandlers } from '@mrstern/logger';

const logger = await initLogger({ logDir: './logs' });

// Register global error handlers
registerProcessHandlers(logger);

// Uncaught exceptions → logs/exceptions.log
// Unhandled rejections → logs/rejections.log
```

**Cleanup:**

```typescript
import { unregisterProcessHandlers } from '@mrstern/logger';

// Remove handlers (for testing or graceful shutdown)
unregisterProcessHandlers();
```

### Metrics Collection

Prometheus-compatible metrics for log monitoring:

```typescript
import {
  getGlobalMetricsCollector,
  withMetrics,
} from '@mrstern/logger/utils/metrics';

const logger = await initLogger({ defaultService: 'api' });
const metricsLogger = withMetrics(logger, 'api');

// Use logger normally - metrics collected automatically
metricsLogger.info({ userId: '123' }, 'User created');
metricsLogger.error({ err: error }, 'Request failed');

// Get metrics in Prometheus format
const metrics = getGlobalMetricsCollector().getMetrics();
console.log(metrics);
```

**Metrics Format:**

```
# HELP log_level_total Total number of logs by level
# TYPE log_level_total counter
log_level_total{level="info"} 1234
log_level_total{level="error"} 56

# HELP log_service_level_total Total number of logs by service and level
# TYPE log_service_level_total counter
log_service_level_total{service="api",level="info"} 1234
log_service_level_total{service="api",level="error"} 56

# HELP log_errors_total Total number of errors by type
# TYPE log_errors_total counter
log_errors_total{service="api",error_type="ValidationError"} 12
```

### Browser Logger

Lightweight logger for frontend applications:

```typescript
import { initBrowserLogger } from '@mrstern/logger/browser';

const logger = initBrowserLogger({
  level: 'info',
  service: 'web-app',
  console: true, // Console output for development

  // Remote logging (production)
  remote: {
    url: 'https://api.example.com/logs',
    headers: {
      Authorization: 'Bearer token',
    },
    batch: {
      size: 50,
      interval: 5000,
    },
    enableOfflineBuffer: true, // LocalStorage buffering
  },

  // Sentry integration
  sentryDsn: 'https://key@sentry.io/project',
});

logger.info('Page loaded');
logger.error({ err: error }, 'Request failed');
```

## Examples

### Express.js API

```typescript
import { initLogger } from '@mrstern/logger';
import express from 'express';

const logger = await initLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultService: 'express-api',
  logDir: './logs',
  telemetry: { enabled: true },
});

const app = express();

// Request logger middleware
app.use((req, res, next) => {
  const requestLogger = logger.child({
    requestId: req.headers['x-request-id'] as string,
    method: req.method,
    path: req.path,
    ip: req.ip,
  });

  requestLogger.info('Request started');

  res.on('finish', () => {
    requestLogger.info(
      { status: res.statusCode, duration: Date.now() - req.startTime },
      'Request completed',
    );
  });

  next();
});

// Routes
app.get('/users/:id', async (req, res) => {
  const logger = req.logger.child({ userId: req.params.id });

  try {
    logger.info('Fetching user');
    const user = await db.users.findById(req.params.id);
    logger.info('User fetched successfully');
    res.json(user);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch user');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handler
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(3000);
```

### Hono Server with OpenTelemetry

```typescript
import { serve } from '@hono/node-server';
import { initLogger } from '@mrstern/logger';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

const logger = await initLogger({
  defaultService: 'hono-api',
  telemetry: {
    enabled: true,
    autoInject: true, // Auto-inject from OpenTelemetry API
  },
});

const app = new Hono();

app.use(requestId());

// Logger middleware
app.use(async (c, next) => {
  const requestLogger = logger.child({
    requestId: c.var.requestId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set('logger', requestLogger);
  requestLogger.info('Request started');

  await next();

  requestLogger.info({ status: c.res.status }, 'Request completed');
});

// Routes
app.get('/api/users/:id', async (c) => {
  const logger = c.var.logger;
  const userId = c.req.param('id');

  try {
    logger.info({ userId }, 'Fetching user');
    const user = await fetchUser(userId);
    logger.info({ userId }, 'User fetched');
    return c.json(user);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to fetch user');
    return c.json({ error: 'User not found' }, 404);
  }
});

serve(app);
```

### React Application

```typescript
// src/logger/LoggerContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { Logger } from '@mrstern/logger';

import { baseLogger } from '@mrstern/logger';

const LoggerContext = createContext<Logger>(baseLogger);

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const [logger] = useState(() =>
    baseLogger.child({
      component: 'react-app',
      version: import.meta.env.VITE_APP_VERSION,
    }),
  );

  useEffect(() => {
    logger.info('Application mounted');
    return () => logger.info('Application unmounted');
  }, [logger]);

  return (
    <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
  );
}

export const useLogger = () => useContext(LoggerContext);
```

```typescript
// src/components/UserProfile.tsx
import { useEffect } from 'react';

import { useLogger } from '../logger/LoggerContext';

function UserProfile({ userId }: { userId: string }) {
  const logger = useLogger();

  useEffect(() => {
    const componentLogger = logger.child({
      component: 'UserProfile',
      userId,
    });

    componentLogger.info('Loading user profile');

    fetchUserProfile(userId)
      .then((profile) => {
        componentLogger.info({ profileId: profile.id }, 'Profile loaded');
      })
      .catch((err) => {
        componentLogger.error({ err }, 'Failed to load profile');
      });
  }, [userId, logger]);

  return <div>User Profile</div>;
}
```

### Background Job Processor

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  level: 'info',
  defaultService: 'job-processor',
  logDir: './logs',
});

async function processJobs() {
  const jobLogger = logger.child({
    component: 'job-processor',
    layer: 'worker',
  });

  jobLogger.info('Starting job processor');

  while (true) {
    try {
      const job = await fetchNextJob();

      const taskLogger = jobLogger.child({
        jobId: job.id,
        jobType: job.type,
      });

      taskLogger.info('Processing job');

      await executeJob(job);

      taskLogger.info(
        { duration: Date.now() - job.startTime },
        'Job completed',
      );
    } catch (error) {
      jobLogger.error({ err: error }, 'Job processing failed');
      await sleep(5000);
    }
  }
}

processJobs();
```

### Distributed System with OpenTelemetry

```typescript
import { initLogger } from '@mrstern/logger';
import { trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  serviceName: 'order-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Initialize logger with auto-injection
const logger = await initLogger({
  defaultService: 'order-service',
  telemetry: {
    enabled: true,
    autoInject: true, // Automatically inject trace context from OpenTelemetry API
  },
});

async function processOrder(orderId: string) {
  const tracer = trace.getTracer('order-service');
  const span = tracer.startSpan('process-order');

  try {
    // Logs automatically include trace_id and span_id
    logger.info({ orderId }, 'Processing order');

    await validateOrder(orderId);
    await chargePayment(orderId);
    await fulfillOrder(orderId);

    logger.info({ orderId }, 'Order processed successfully');
  } catch (error) {
    logger.error({ err: error, orderId }, 'Order processing failed');
    throw error;
  } finally {
    span.end();
  }
}
```

## API Reference

### initLogger(options?)

Initialize a custom logger instance with configuration.

**Options:**

| Property              | Type                     | Default         | Description                    |
| --------------------- | ------------------------ | --------------- | ------------------------------ |
| `level`               | `LogLevel`               | `'info'`        | Minimum log level to output    |
| `defaultService`      | `string`                 | `'app'`         | Default service name for logs  |
| `logDir`              | `string`                 | `'./logs'`      | Log directory path             |
| `fileRotationOptions` | `FileRotationOptions`    | See below       | File rotation configuration    |
| `telemetry`           | `TelemetryOptions`       | See below       | OpenTelemetry integration      |
| `redactionOptions`    | `RedactionOptions`       | See below       | Custom redaction configuration |
| `prettyPrint`         | `boolean`                | `true`          | Enable pretty console output   |
| `formatStyle`         | `'compact' \| 'default'` | `'compact'`     | Console log format style       |
| `nodeEnv`             | `string`                 | `'development'` | Node environment               |
| `redactPaths`         | `string[]`               | Default paths   | Paths to redact                |

**FileRotationOptions:**

| Property    | Type                  | Default   | Description                   |
| ----------- | --------------------- | --------- | ----------------------------- |
| `maxSize`   | `string`              | `'10m'`   | Max file size before rotation |
| `maxFiles`  | `number`              | `14`      | Number of files to retain     |
| `frequency` | `'daily' \| 'hourly'` | `'daily'` | Rotation frequency            |

**TelemetryOptions:**

| Property         | Type                      | Default | Description                             |
| ---------------- | ------------------------- | ------- | --------------------------------------- |
| `enabled`        | `boolean`                 | `false` | Enable telemetry integration            |
| `autoInject`     | `boolean`                 | `false` | Auto-inject trace context from OTel API |
| `contextOptions` | `TelemetryContextOptions` | -       | Custom context options                  |

**RedactionOptions:**

| Property | Type       | Default        | Description                     |
| -------- | ---------- | -------------- | ------------------------------- |
| `paths`  | `string[]` | Default paths  | Custom paths to redact          |
| `censor` | `string`   | `'[Redacted]'` | Replacement text                |
| `remove` | `boolean`  | `false`        | Remove fields instead of censor |

**Returns:** `Promise<Logger>`

### baseLogger

Pre-configured logger instance ready to use immediately.

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info('Quick and easy logging');
```

### Logger Methods

**Standard logging methods:**

```typescript
logger.fatal(obj, msg); // Log fatal error (level 60)
logger.error(obj, msg); // Log error (level 50)
logger.warn(obj, msg); // Log warning (level 40)
logger.info(obj, msg); // Log info (level 30)
logger.debug(obj, msg); // Log debug (level 20)
logger.trace(obj, msg); // Log trace (level 10)
```

**Telemetry methods:**

```typescript
logger.setTraceContext(context: SpanContext): void;      // Set trace context
logger.getTraceContext(): SpanContext | undefined;       // Get current trace context
logger.clearTraceContext(): void;                        // Clear trace context
```

**Child logger:**

```typescript
logger.child(bindings: object): Logger;                  // Create child logger with inherited context
```

### Types

**SpanContext:**

```typescript
interface SpanContext {
  traceId: string; // Trace ID (32 hex chars)
  spanId: string; // Span ID (16 hex chars)
  traceFlags?: string; // Trace flags as hex string (e.g., '01')
  traceState?: string; // Optional trace state
}
```

**ServiceMetadata:**

```typescript
interface ServiceMetadata {
  service?: string; // Service name
  component?: string; // Component/module name
  operation?: string; // Operation being performed
  layer?: string; // Application layer (e.g., 'controller', 'service')
  domain?: string; // Business domain
  integration?: string; // External integration name
}
```

**LogLevel:**

```typescript
type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
```

## Requirements

- **Node.js** >= 18 or **Bun** >= 1.0
- **TypeScript** >= 5.0

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/0xstern/stern-logger).

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.

---

## Appendix

### Distributed Tracing Setup

Complete end-to-end tracing from browser through backend services.

#### Overview

Distributed tracing requires three components:

1. **W3C Trace Context Propagation** - Browser → Backend via HTTP headers
2. **OpenTelemetry SDK** - Instrumentation and span collection
3. **Logger Integration** - Automatic trace context injection

#### Browser Setup

**1. Install dependencies:**

```bash
npm install @opentelemetry/sdk-trace-web @opentelemetry/instrumentation-fetch
```

**2. Initialize OpenTelemetry:**

```typescript
// src/telemetry/browser.ts

import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';

const provider = new WebTracerProvider();

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
    }),
  ),
);

provider.register({
  propagator: new W3CTraceContextPropagator(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [/api\.example\.com/],
      clearTimingResources: true,
    }),
  ],
});
```

**3. Use with logger:**

```typescript
import { initBrowserLogger } from '@mrstern/logger/browser';
import { trace } from '@opentelemetry/api';

const logger = initBrowserLogger({ service: 'web-app' });

// Fetch automatically propagates trace context via traceparent header
async function fetchUser(userId: string) {
  const tracer = trace.getTracer('web-app');
  const span = tracer.startSpan('fetch-user');

  try {
    logger.info({ userId }, 'Fetching user');

    const response = await fetch(`/api/users/${userId}`);
    const user = await response.json();

    logger.info({ userId }, 'User fetched');
    return user;
  } catch (err) {
    logger.error({ err, userId }, 'Fetch failed');
    throw err;
  } finally {
    span.end();
  }
}
```

#### Backend Setup

**1. Install dependencies:**

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**2. Initialize OpenTelemetry SDK:**

```typescript
// src/telemetry/server.ts

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const sdk = new NodeSDK({
  serviceName: 'api-server',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error));
});
```

**3. Configure logger with auto-injection:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  defaultService: 'api-server',
  telemetry: {
    enabled: true,
    autoInject: true, // Automatically inject trace context from OpenTelemetry API
  },
});

// All logs automatically include trace_id and span_id
logger.info('Server started');
```

#### Hono Middleware

```typescript
import { serve } from '@hono/node-server';
import { initLogger } from '@mrstern/logger';
import { context as otelContext, trace } from '@opentelemetry/api';
import { Hono } from 'hono';

const logger = await initLogger({
  telemetry: { enabled: true, autoInject: true },
});

const app = new Hono();

// Trace context is automatically available via OpenTelemetry instrumentation
app.use(async (c, next) => {
  const requestLogger = logger.child({
    method: c.req.method,
    path: c.req.path,
  });

  c.set('logger', requestLogger);
  requestLogger.info('Request started'); // Includes trace_id and span_id

  await next();

  requestLogger.info({ status: c.res.status }, 'Request completed');
});

serve(app);
```

#### Express Middleware

```typescript
import { initLogger } from '@mrstern/logger';
import express from 'express';

const logger = await initLogger({
  telemetry: { enabled: true, autoInject: true },
});

const app = express();

// Trace context automatically available via OpenTelemetry instrumentation
app.use((req, res, next) => {
  const requestLogger = logger.child({
    method: req.method,
    path: req.path,
  });

  req.logger = requestLogger;
  requestLogger.info('Request started'); // Includes trace_id and span_id

  next();
});

app.listen(3000);
```

#### Trace Context Flow

```
Browser                 Backend                 Database
-------                 -------                 --------
fetch() →
  [traceparent: 00-{traceId}-{spanId}-01]
                  →     HTTP instrumentation extracts trace context
                        logger.info() includes trace_id, span_id
                                  →     Database query includes trace_id
```

#### Verification

**1. Check logs include trace context:**

```json
{
  "level": 30,
  "time": 1234567890,
  "service": "api-server",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "msg": "Request started"
}
```

**2. View traces in Tempo:**

```bash
# Query by trace ID
curl "http://localhost:3200/api/traces/4bf92f3577b34da6a3ce929d0e0e4736"
```

**3. Correlate logs in Loki:**

```promql
# Find all logs for a trace
{service="api-server"} |= "4bf92f3577b34da6a3ce929d0e0e4736"
```

### LGTM Stack Configuration

Complete setup for Grafana's LGTM stack (Loki, Tempo, Grafana, Mimir).

#### Overview

The LGTM stack provides:

- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **Grafana** - Visualization and dashboards
- **Mimir** - Metrics storage (optional)

#### Docker Compose Setup

**docker-compose.yml:**

```yaml
version: '3'

services:
  loki:
    image: grafana/loki:latest
    ports:
      - '3100:3100'
    command: -config.file=/etc/loki/local-config.yaml

  tempo:
    image: grafana/tempo:latest
    ports:
      - '3200:3200' # Tempo
      - '4318:4318' # OTLP HTTP
    command: -config.file=/etc/tempo/tempo.yaml

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3000:3000'
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning

  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

#### Logger Configuration

**Loki Transport:**

```typescript
import { initLogger } from '@mrstern/logger';
import { createLokiTransport } from '@mrstern/logger/transports/loki';

const logger = await initLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  defaultService: process.env.SERVICE_NAME ?? 'api',
  nodeEnv: process.env.NODE_ENV ?? 'production',

  telemetry: {
    enabled: true,
    autoInject: true, // Auto-inject trace_id and span_id
  },

  transports: [
    createLokiTransport({
      host: process.env.LOKI_URL ?? 'http://localhost:3100',

      // Low-cardinality labels for efficient indexing
      labels: {
        service: process.env.SERVICE_NAME ?? 'api',
        env: process.env.NODE_ENV ?? 'production',
      },

      // Batching for performance
      batching: {
        interval: 5000, // Send batch every 5 seconds
        size: 1000, // Or when 1000 logs accumulated
      },

      // Authentication (Grafana Cloud)
      basicAuth: process.env.LOKI_AUTH, // Format: 'userId:apiKey'

      json: true, // Structured JSON logging
      silenceErrors: false, // Log transport errors
    }),
  ],
});
```

#### Grafana Datasource Configuration

**grafana/provisioning/datasources/datasources.yml:**

```yaml
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    jsonData:
      derivedFields:
        - datasourceUid: tempo
          matcherRegex: '"trace_id":"([^"]+)"'
          name: TraceID
          url: '$${__value.raw}'

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    uid: tempo
    jsonData:
      tracesToLogs:
        datasourceUid: loki
        tags: ['service']
        mappedTags: [{ key: 'service', value: 'service' }]
        filterByTraceID: true
        filterBySpanID: false

  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
```

#### Metrics Endpoint

**Expose Prometheus metrics:**

```typescript
import {
  createMetricsMiddleware,
  withMetrics,
} from '@mrstern/logger/utils/metrics';
import { Hono } from 'hono';

const app = new Hono();

const logger = withMetrics(await initLogger({ defaultService: 'api' }), 'api');

// Expose metrics
app.get('/metrics', createMetricsMiddleware());

// Use logger - metrics collected automatically
app.get('/users/:id', async (c) => {
  logger.info({ userId: c.req.param('id') }, 'Fetching user');
  // ...
});
```

**prometheus.yml:**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-server'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
```

#### Grafana Dashboards

**LogQL Queries:**

```promql
# All logs for a service
{service="api"}

# Error logs only
{service="api"} |= "level\":50"

# Logs for a specific trace
{service="api"} |= "4bf92f3577b34da6a3ce929d0e0e4736"

# Error rate
sum(rate({service="api"} |= "level\":50" [5m]))

# Logs by component
sum by (component) (rate({service="api"}[5m]))
```

**Example Dashboard Panel (Error Rate):**

```json
{
  "title": "Error Rate",
  "type": "graph",
  "datasource": "Loki",
  "targets": [
    {
      "expr": "sum(rate({service=\"api\"} |= \"level\\\":50\" [5m]))"
    }
  ]
}
```

#### Correlation

**Logs → Traces:**

Click trace ID in Loki log viewer → Opens trace in Tempo

**Traces → Logs:**

Click span in Tempo → Shows related logs in Loki

**Metrics → Logs:**

Click metric spike in Grafana → View logs for that time range

#### Production Considerations

**1. Loki Retention:**

```yaml
# loki-config.yaml
limits_config:
  retention_period: 744h # 31 days
```

**2. Batching:**

```typescript
batching: {
  interval: 5000,  // Balance latency vs. throughput
  size: 1000,      // Prevent memory issues
}
```

**3. Labels:**

Keep cardinality low - avoid high-cardinality labels like user IDs:

```typescript
labels: {
  service: 'api',        // Good: Low cardinality
  env: 'production',     // Good: Low cardinality
  // userId: userId,     // Bad: High cardinality - use filter instead
}
```

**4. Error Handling:**

```typescript
silenceErrors: false, // Log transport errors during development
silenceErrors: true,  // Silence in production to prevent log spam
```

---

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
