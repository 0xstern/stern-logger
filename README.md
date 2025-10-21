# Stern Logger

Production-ready structured logging library built on Pino with OpenTelemetry integration, automatic trace correlation, and enterprise-grade security features.

<p>
    <a href="https://github.com/0xstern/stern-logger/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xstern/stern-logger/ci.yml?branch=main" alt="Build Status"></a>
    <a href="https://github.com/0xstern/stern-logger/releases"><img src="https://img.shields.io/npm/v/@mrstern/logger.svg" alt="Latest Release"></a>
    <a href="https://github.com/0xstern/stern-logger/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@mrstern/logger.svg" alt="License"></a>
    <a href="https://twitter.com/mrstern_"><img alt="X (formerly Twitter) Follow" src="https://img.shields.io/twitter/follow/mrstern_.svg?style=social"></a>
</p>

## Features

- **Structured JSON Logging** - High-performance logging built on Pino
- **OpenTelemetry Integration** - Automatic trace context correlation for distributed systems
- **Sensitive Data Redaction** - Automatic redaction of passwords, tokens, and credentials
- **File Rotation** - Configurable rotation with retention policies via pino-roll
- **Error Handling** - Built-in handlers for uncaught exceptions and unhandled rejections
- **Input Validation** - Security safeguards with size limits and prototype pollution protection
- **Pretty Console Output** - Development-friendly formatting via pino-pretty
- **TypeScript First** - Full type definitions with strict type safety

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

## Quick Start

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info('Application started');
baseLogger.error({ err: new Error('Connection failed') }, 'Database error');
baseLogger.warn({ userId: '123' }, 'Rate limit exceeded');
```

## Core Concepts

### Structured Logging

Add contextual metadata to logs for filtering, searching, and analysis.

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info(
  {
    service: 'auth-service',
    component: 'authentication',
    operation: 'login',
    userId: '12345',
    ip: '192.168.1.1',
  },
  'User login successful',
);
```

**Child loggers inherit context:**

```typescript
const userLogger = baseLogger.child({
  component: 'user-management',
  operation: 'create',
});

userLogger.info({ userId: '123' }, 'User created');
userLogger.debug({ email: 'user@example.com' }, 'Sending verification email');
```

### OpenTelemetry Integration

Correlate logs with distributed traces using OpenTelemetry span context.

**Manual Context Management:**

```typescript
import { baseLogger } from '@mrstern/logger';

// Set trace context explicitly
baseLogger.setTraceContext({
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  traceFlags: '01',
});

baseLogger.info('Processing request'); // Includes trace context
baseLogger.clearTraceContext();
```

**Auto-Injection:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  telemetry: { enabled: true, autoInject: true },
});

// Trace context injected automatically when span is active
logger.info('Request processed');
```

### Sensitive Data Redaction

Automatically redact sensitive fields from logs.

```typescript
baseLogger.info({
  username: 'john.doe',
  password: 'secret123', // Redacted: '[Redacted]'
  apiKey: 'sk-1234567890', // Redacted: '[Redacted]'
  creditCard: '4111-1111-1111-1111', // Redacted: '[Redacted]'
});
```

**Custom redaction paths:**

```typescript
const logger = await initLogger({
  redactionOptions: {
    paths: ['user.email', 'payment.cardNumber', 'session.token'],
    censor: '[HIDDEN]',
  },
});
```

**Default redacted fields:**

`password`, `creditCard`, `auth`, `authorization`, `cookie`, `token`, `apiKey`, `secret`, `ssn` (including nested paths: `*.field`, `*.*.field`)

### Error Handling

Built-in error serialization with stack traces and cause chains.

```typescript
try {
  await riskyOperation();
} catch (error) {
  baseLogger.error({ err: error }, 'Operation failed');
  // Logs full error with stack trace, cause chain, and custom properties
}
```

**Add context to errors:**

```typescript
baseLogger.error(
  {
    err: error,
    userId: '123',
    operation: 'payment',
    amount: 99.99,
  },
  'Payment processing failed',
);
```

## Framework Integration

### Express.js

```typescript
import { initLogger } from '@mrstern/logger';
import express from 'express';

const logger = await initLogger({
  defaultService: 'express-api',
  telemetry: { enabled: true },
});

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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Request failed');
  res.status(500).json({ error: 'Internal server error' });
});
```

### Hono Server

```typescript
import { serve } from '@hono/node-server';
import { initLogger } from '@mrstern/logger';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

const logger = await initLogger({
  defaultService: 'hono-api',
  telemetry: { enabled: true, autoInject: true },
});

const app = new Hono();

// Request ID middleware
app.use(requestId());

// Logger middleware
app.use(async (c, next) => {
  const requestLogger = logger.child({
    requestId: c.var.requestId,
    method: c.req.method,
    path: c.req.path,
  });

  c.set('logger', requestLogger);
  requestLogger.info('Incoming request');

  await next();

  requestLogger.info({ status: c.res.status }, 'Request completed');
});

// Routes
app.get('/', (c) => {
  c.var.logger.info('Processing root request');
  return c.json({ message: 'Hello from Hono!' });
});

// Error handler
app.onError((err, c) => {
  c.var.logger.error({ err }, 'Request failed');
  return c.json({ error: 'Internal server error' }, 500);
});

serve(app);
```

### React

**Context provider:**

```typescript
// LoggerContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { Logger } from '@mrstern/logger';

import { baseLogger } from '@mrstern/logger';

const LoggerContext = createContext<Logger>(baseLogger);

export function LoggerProvider({ children }: { children: React.ReactNode }) {
  const [logger] = useState(() => baseLogger.child({ component: 'react-app' }));

  useEffect(() => {
    logger.info('React app mounted');
    return () => logger.info('React app unmounted');
  }, [logger]);

  return (
    <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
  );
}

export const useLogger = () => useContext(LoggerContext);
```

**Component usage:**

```typescript
function UserProfile({ userId }: { userId: string }) {
  const logger = useLogger();

  useEffect(() => {
    const componentLogger = logger.child({ userId, component: 'UserProfile' });
    componentLogger.info('Loading user profile');

    fetchUserProfile(userId)
      .then(() => componentLogger.info('Profile loaded'))
      .catch((err) => componentLogger.error({ err }, 'Failed to load profile'));
  }, [userId, logger]);

  return <div>User Profile</div>;
}
```

### Background Jobs

```typescript
import { baseLogger } from '@mrstern/logger';

async function processBackgroundJobs() {
  const jobLogger = baseLogger.child({
    component: 'job-processor',
    layer: 'worker',
  });

  jobLogger.info('Starting job processor');

  while (true) {
    try {
      const job = await fetchNextJob();

      jobLogger.info({ jobId: job.id, jobType: job.type }, 'Processing job');
      await executeJob(job);
      jobLogger.info({ jobId: job.id }, 'Job completed');
    } catch (error) {
      jobLogger.error({ err: error }, 'Job processing failed');
      await sleep(5000);
    }
  }
}
```

### Microservices with OpenTelemetry

```typescript
import { initLogger } from '@mrstern/logger';
import { trace } from '@opentelemetry/api';

const logger = await initLogger({
  telemetry: { enabled: true, autoInject: true },
});

async function processOrder(orderId: string) {
  const tracer = trace.getTracer('order-service');
  const span = tracer.startSpan('process-order');

  try {
    logger.info({ orderId }, 'Processing order'); // Trace context auto-injected
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

| Property              | Type                                                           | Default                                         | Description                    |
| --------------------- | -------------------------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| `level`               | `'fatal' \| 'error' \| 'warn' \| 'info' \| 'debug' \| 'trace'` | `info` (prod)<br/>`debug` (dev)                 | Minimum log level to output    |
| `defaultService`      | `string`                                                       | `process.env.LOG_DEFAULT_SERVICE_NAME \| 'app'` | Default service name for logs  |
| `logDir`              | `string`                                                       | `process.env.LOG_DIR \| './logs'`               | Log directory path             |
| `fileRotationOptions` | `FileRotationOptions`                                          | See below                                       | File rotation configuration    |
| `telemetry`           | `TelemetryOptions`                                             | `{ enabled: false }`                            | OpenTelemetry integration      |
| `redactionOptions`    | `RedactionOptions`                                             | Default paths redacted                          | Custom redaction configuration |
| `prettyPrint`         | `boolean`                                                      | `true` (dev)<br/>`false` (prod)                 | Enable pretty console output   |

**FileRotationOptions:**

| Property    | Type                  | Default | Description                   |
| ----------- | --------------------- | ------- | ----------------------------- |
| `maxSize`   | `string`              | `10m`   | Max file size before rotation |
| `maxFiles`  | `number`              | `14`    | Number of files to retain     |
| `frequency` | `'daily' \| 'hourly'` | `daily` | Rotation frequency            |

**TelemetryOptions:**

| Property     | Type      | Default | Description                        |
| ------------ | --------- | ------- | ---------------------------------- |
| `enabled`    | `boolean` | `false` | Enable telemetry integration       |
| `autoInject` | `boolean` | `false` | Auto-inject trace context from API |

**RedactionOptions:**

| Property | Type       | Default       | Description                     |
| -------- | ---------- | ------------- | ------------------------------- |
| `paths`  | `string[]` | Default paths | Custom paths to redact          |
| `censor` | `string`   | `[Redacted]`  | Replacement text                |
| `remove` | `boolean`  | `false`       | Remove fields instead of censor |

**Returns:** `Promise<Logger>`

**Example:**

```typescript
const logger = await initLogger({
  level: 'debug',
  defaultService: 'payment-api',
  logDir: '/var/log/payment-api',
  fileRotationOptions: {
    maxSize: '20m',
    maxFiles: 30,
    frequency: 'daily',
  },
  telemetry: {
    enabled: true,
    autoInject: true,
  },
  redactionOptions: {
    paths: ['payment.cardNumber', 'user.ssn'],
    censor: '[HIDDEN]',
  },
});
```

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
logger.setTraceContext(context: SpanContext): void      // Set trace context
logger.getTraceContext(): SpanContext | undefined       // Get current trace context
logger.clearTraceContext(): void                        // Clear trace context
```

**Child logger:**

```typescript
logger.child(bindings: object): Logger                  // Create child logger with inherited context
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
  layer?: string; // Application layer (e.g., 'controller', 'service', 'repository')
  domain?: string; // Business domain
  integration?: string; // External integration name
}
```

## Configuration

### Environment Variables

**Core Configuration:**

| Variable                   | Description          | Default                         | Example                          |
| -------------------------- | -------------------- | ------------------------------- | -------------------------------- |
| `LOG_LEVEL`                | Minimum log level    | `info` (prod)<br/>`debug` (dev) | `debug`, `info`, `warn`, `error` |
| `NODE_ENV`                 | Node environment     | `development`                   | `production`, `staging`          |
| `LOG_DEFAULT_SERVICE_NAME` | Default service name | `app`                           | `my-service`, `payment-api`      |
| `LOG_DIR`                  | Log directory path   | `./logs`                        | `/var/log/myapp`                 |

**File Rotation:**

| Variable                 | Description               | Default | Example              |
| ------------------------ | ------------------------- | ------- | -------------------- |
| `LOG_ROTATION_MAX_SIZE`  | Max file size             | `10m`   | `10m`, `50m`, `100m` |
| `LOG_ROTATION_MAX_FILES` | Number of files to retain | `14`    | `7`, `14`, `30`      |
| `LOG_ROTATION_FREQUENCY` | Rotation frequency        | `daily` | `daily`, `hourly`    |

**Validation Limits:**

| Variable                      | Description                | Default         | Example             |
| ----------------------------- | -------------------------- | --------------- | ------------------- |
| `LOG_MAX_MESSAGE_LENGTH`      | Max log message length     | `10000`         | `5000`, `20000`     |
| `LOG_MAX_META_SIZE`           | Max metadata size (bytes)  | `1000000` (1MB) | `500000`, `2000000` |
| `LOG_MAX_SERVICE_NAME_LENGTH` | Max service name length    | `100`           | `50`, `200`         |
| `LOG_MAX_CONTEXT_FIELDS`      | Max context fields per log | `50`            | `25`, `100`         |
| `LOG_MAX_STRING_FIELD_LENGTH` | Max string field length    | `1000`          | `500`, `2000`       |

**Telemetry:**

| Variable                            | Description               | Default          | Example           |
| ----------------------------------- | ------------------------- | ---------------- | ----------------- |
| `LOG_TELEMETRY_MAX_CONTEXT_SIZE`    | Max trace contexts stored | `10000`          | `5000`, `20000`   |
| `LOG_TELEMETRY_TTL_MS`              | Trace context TTL (ms)    | `300000` (5 min) | `60000`, `600000` |
| `LOG_TELEMETRY_CLEANUP_INTERVAL_MS` | Cleanup interval (ms)     | `60000` (1 min)  | `30000`, `120000` |

**Example configuration:**

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
LOG_DEFAULT_SERVICE_NAME=my-api
LOG_DIR=./logs
LOG_ROTATION_MAX_SIZE=10m
LOG_ROTATION_MAX_FILES=7

# Production
NODE_ENV=production
LOG_LEVEL=info
LOG_DEFAULT_SERVICE_NAME=payment-api
LOG_DIR=/var/log/payment-api
LOG_ROTATION_MAX_SIZE=50m
LOG_ROTATION_MAX_FILES=30
LOG_MAX_MESSAGE_LENGTH=20000
LOG_TELEMETRY_MAX_CONTEXT_SIZE=20000
```

**Behavior notes:**

- Environment variables can be overridden by `initLogger()` options
- Validation limits prevent memory issues and DoS attacks
- Telemetry TTL and cleanup prevent memory leaks in long-running processes

## Advanced Topics

### File Rotation

Configure file rotation for production environments.

```typescript
const logger = await initLogger({
  logDir: '/var/log/myapp',
  fileRotationOptions: {
    maxSize: '10m', // Rotate when file reaches 10MB
    maxFiles: 14, // Keep last 14 files
    frequency: 'daily', // Rotate daily
  },
});
```

**Log file locations:**

- `<logDir>/app.log` - Main application logs
- `<logDir>/exceptions.log` - Uncaught exceptions
- `<logDir>/rejections.log` - Unhandled promise rejections

### Process Exception Handling

Automatically log uncaught exceptions and unhandled rejections.

```typescript
const logger = await initLogger({
  logDir: './logs',
});

// Uncaught exceptions and unhandled rejections are automatically logged
// to separate files and to the main logger
```

### Validation Limits

Security and performance limits enforced by the logger:

- **Message Length**: 10,000 characters (truncated with ellipsis)
- **Metadata Size**: 1 MB (rejected if exceeded)
- **Context Fields**: 50 fields maximum (extras ignored)
- **Trace Context TTL**: 5 minutes (auto-cleanup)
- **Max Trace Contexts**: 10,000 (LRU eviction)

### Performance

- **Pino Foundation**: Built on one of the fastest Node.js loggers
- **Fast Redaction**: ~2% overhead for non-wildcard paths
- **Efficient Mixin**: Trace context injection via Pino's native mixin
- **Lazy Evaluation**: Metadata validated only when logged
- **Optimized Serialization**: Custom error serializer with minimal overhead

## Development

### Scripts

```bash
# Build the package
bun run build

# Run tests
bun test

# Lint code
bun run lint

# Fix linting issues
bun run lint:fix

# Format code
bun run format

# Check formatting
bun run format:check
```

### Requirements

- Node.js >= 23.11.0
- TypeScript ^5.0.0 (peer dependency)

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/0xstern/stern-logger).

## Support

If you find this helpful, follow me on X [@mrstern\_](https://x.com/mrstern_)
