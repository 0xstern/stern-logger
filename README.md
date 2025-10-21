# Stern Logger

A production-ready structured logging library built on Pino with OpenTelemetry support and advanced transport capabilities.

<p>
    <a href="https://github.com/0xstern/stern-logger/actions"><img src="https://img.shields.io/github/actions/workflow/status/0xstern/stern-logger/ci.yml?branch=main" alt="Build Status"></a>
    <a href="https://github.com/0xstern/stern-logger/releases"><img src="https://img.shields.io/npm/v/@mrstern/logger.svg" alt="Latest Release"></a>
    <a href="https://github.com/0xstern/stern-logger/blob/main/LICENSE.md"><img src="https://img.shields.io/npm/l/@mrstern/logger.svg" alt="License"></a>
    <a href="https://twitter.com/mrstern_"><img alt="X (formerly Twitter) Follow" src="https://img.shields.io/twitter/follow/mrstern_.svg?style=social"></a>
</p>

## Features

- **Structured JSON Logging** - Built on Pino for high-performance structured logging
- **OpenTelemetry Integration** - Automatic trace context correlation for distributed systems
- **File Rotation** - Configurable file rotation with retention policies via pino-roll
- **Pretty Console Output** - Development-friendly console formatting via pino-pretty
- **Sensitive Data Redaction** - Automatic redaction of passwords, tokens, and other sensitive fields
- **Process Exception Handling** - Built-in handlers for uncaught exceptions and unhandled rejections
- **Input Validation** - Security safeguards with size limits and prototype pollution protection
- **TypeScript First** - Full TypeScript support with comprehensive type definitions

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

### Quick Start

**1. Use the pre-configured base logger:**

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info('Application started');
baseLogger.error({ err: new Error('Connection failed') }, 'Database error');
baseLogger.warn({ userId: '123' }, 'User exceeded rate limit');
```

**2. Create a custom logger instance:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  level: 'debug',
  defaultService: 'my-api',
  logDir: './logs',
  fileRotationOptions: {
    maxSize: '10m',
    maxFiles: 14,
    frequency: 'daily',
  },
  telemetry: {
    enabled: true,
  },
});

logger.info('Custom logger initialized');
```

### Structured Logging

**Service metadata for organized logs:**

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info(
  {
    service: 'auth-service',
    component: 'authentication',
    operation: 'login',
    layer: 'application',
    userId: '12345',
    ip: '192.168.1.1',
  },
  'User login successful',
);
```

**Child loggers with inherited context:**

```typescript
const userLogger = baseLogger.child({
  component: 'user-management',
  operation: 'create',
});

userLogger.info({ userId: '123' }, 'User created');
userLogger.debug({ email: 'user@example.com' }, 'Sending verification email');
```

### OpenTelemetry Integration

**Manual trace context management:**

```typescript
import { baseLogger } from '@mrstern/logger';

// Set trace context for the current thread/process
baseLogger.setTraceContext({
  traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
  spanId: '00f067aa0ba902b7',
  traceFlags: 1,
});

// All subsequent logs include trace context
baseLogger.info({ userId: '123' }, 'Processing user request');

// Clear trace context when done
baseLogger.clearTraceContext();
```

**Automatic trace context injection:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  telemetry: {
    enabled: true,
    autoInject: true, // Automatically inject trace context from OpenTelemetry API
  },
});

// Trace context is automatically included if active span exists
logger.info('Request processed');
```

### Error Logging

**Built-in error serialization:**

```typescript
try {
  await riskyOperation();
} catch (error) {
  baseLogger.error({ err: error }, 'Operation failed');
  // Logs full error with stack trace, cause chain, and custom properties
}
```

**Custom error context:**

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

### Sensitive Data Redaction

**Automatic redaction of sensitive fields:**

```typescript
baseLogger.info({
  username: 'john.doe',
  password: 'secret123', // Automatically redacted
  apiKey: 'sk-1234567890', // Automatically redacted
  creditCard: '4111-1111-1111-1111', // Automatically redacted
});

// Output: { username: 'john.doe', password: '[Redacted]', apiKey: '[Redacted]', creditCard: '[Redacted]' }
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

### File Rotation

**Configure file rotation for production:**

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

Logs are written to:

- `<logDir>/app.log` - Main application logs
- `<logDir>/exceptions.log` - Uncaught exceptions
- `<logDir>/rejections.log` - Unhandled promise rejections

### Process Exception Handling

**Automatic registration of exception handlers:**

```typescript
import { initLogger } from '@mrstern/logger';

const logger = await initLogger({
  logDir: './logs',
});

// Uncaught exceptions and unhandled rejections are automatically logged
// to separate files and to the main logger
```

## API Reference

### initLogger(options?)

Initializes a new logger instance with custom configuration.

**Parameters:**

```typescript
interface LoggerOptions {
  // Log level (default: 'info' or process.env.LOG_LEVEL)
  level?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

  // Default service name (default: process.env.SERVICE_NAME || 'app')
  defaultService?: string;

  // Log directory path (default: './logs' or process.env.LOG_DIR)
  logDir?: string;

  // File rotation options
  fileRotationOptions?: {
    maxSize?: string; // Max file size before rotation (default: '10m')
    maxFiles?: number; // Number of files to retain (default: 14)
    frequency?: 'daily' | 'hourly'; // Rotation frequency (default: 'daily')
  };

  // OpenTelemetry options
  telemetry?: {
    enabled?: boolean; // Enable telemetry integration (default: false)
    autoInject?: boolean; // Auto-inject trace context (default: false)
  };

  // Redaction options
  redactionOptions?: {
    paths?: string[]; // Custom paths to redact
    censor?: string; // Replacement text (default: '[Redacted]')
    remove?: boolean; // Remove fields instead of censoring
  };

  // Pretty print options (console only)
  prettyPrint?: boolean; // Enable pretty console output (default: true in dev)
}
```

**Returns:**

```typescript
Promise<Logger>;
```

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

Pre-configured logger instance with sensible defaults, ready to use immediately.

**Example:**

```typescript
import { baseLogger } from '@mrstern/logger';

baseLogger.info('Quick and easy logging');
```

### Logger Methods

The logger instance extends Pino's logger with additional methods:

**Standard Pino methods:**

```typescript
logger.fatal(obj, msg); // Log fatal error (level 60)
logger.error(obj, msg); // Log error (level 50)
logger.warn(obj, msg); // Log warning (level 40)
logger.info(obj, msg); // Log info (level 30)
logger.debug(obj, msg); // Log debug (level 20)
logger.trace(obj, msg); // Log trace (level 10)
```

**Enhanced telemetry methods:**

```typescript
// Set trace context for current thread
logger.setTraceContext(context: SpanContext): void

// Get current trace context
logger.getTraceContext(): SpanContext | undefined

// Clear trace context
logger.clearTraceContext(): void
```

**Child logger creation:**

```typescript
logger.child(bindings: object): Logger
```

### Types

**SpanContext:**

```typescript
interface SpanContext {
  traceId: string; // Trace ID (32 hex chars)
  spanId: string; // Span ID (16 hex chars)
  traceFlags?: number; // Trace flags (0 or 1)
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

The logger respects the following environment variables:

#### Core Configuration

| Variable       | Description                   | Default                                       | Example                                |
| -------------- | ----------------------------- | --------------------------------------------- | -------------------------------------- |
| `LOG_LEVEL`    | Minimum log level to output   | `info` (production)<br/>`debug` (development) | `debug`, `info`, `warn`, `error`       |
| `NODE_ENV`     | Node environment              | `development`                                 | `production`, `development`, `staging` |
| `SERVICE_NAME` | Default service name for logs | `app`                                         | `my-service`, `payment-api`            |
| `LOG_DIR`      | Directory for log files       | `./logs`                                      | `/var/log/myapp`, `./logs`             |

#### File Rotation Configuration

| Variable                 | Description                       | Default | Example              |
| ------------------------ | --------------------------------- | ------- | -------------------- |
| `LOG_ROTATION_MAX_SIZE`  | Maximum file size before rotation | `10m`   | `10m`, `50m`, `100m` |
| `LOG_ROTATION_MAX_FILES` | Number of rotated files to retain | `14`    | `7`, `14`, `30`      |
| `LOG_ROTATION_FREQUENCY` | Rotation frequency                | `daily` | `daily`, `hourly`    |

#### Validation Limits

| Variable                      | Description                        | Default         | Example                  |
| ----------------------------- | ---------------------------------- | --------------- | ------------------------ |
| `LOG_MAX_MESSAGE_LENGTH`      | Maximum log message length (chars) | `10000`         | `5000`, `10000`, `20000` |
| `LOG_MAX_META_SIZE`           | Maximum metadata size (bytes)      | `1000000` (1MB) | `500000`, `2000000`      |
| `LOG_MAX_SERVICE_NAME_LENGTH` | Maximum service name length        | `100`           | `50`, `100`, `200`       |
| `LOG_MAX_CONTEXT_FIELDS`      | Maximum context fields per log     | `50`            | `25`, `50`, `100`        |
| `LOG_MAX_STRING_FIELD_LENGTH` | Maximum string field length        | `1000`          | `500`, `1000`, `2000`    |

#### Telemetry Configuration

| Variable                            | Description                      | Default          | Example                     |
| ----------------------------------- | -------------------------------- | ---------------- | --------------------------- |
| `LOG_TELEMETRY_MAX_CONTEXT_SIZE`    | Maximum trace contexts stored    | `10000`          | `5000`, `10000`, `20000`    |
| `LOG_TELEMETRY_TTL_MS`              | Trace context TTL (milliseconds) | `300000` (5 min) | `60000`, `300000`, `600000` |
| `LOG_TELEMETRY_CLEANUP_INTERVAL_MS` | Cleanup interval (milliseconds)  | `60000` (1 min)  | `30000`, `60000`, `120000`  |

**Example configuration:**

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug
SERVICE_NAME=my-api
LOG_DIR=./logs
LOG_ROTATION_MAX_SIZE=10m
LOG_ROTATION_MAX_FILES=7

# Production
NODE_ENV=production
LOG_LEVEL=info
SERVICE_NAME=payment-api
LOG_DIR=/var/log/payment-api
LOG_ROTATION_MAX_SIZE=50m
LOG_ROTATION_MAX_FILES=30
LOG_MAX_MESSAGE_LENGTH=20000
LOG_TELEMETRY_MAX_CONTEXT_SIZE=20000

# High-security environment (stricter limits)
NODE_ENV=production
LOG_LEVEL=warn
LOG_MAX_MESSAGE_LENGTH=5000
LOG_MAX_META_SIZE=500000
LOG_MAX_CONTEXT_FIELDS=25
```

**Behavior notes:**

- If `LOG_LEVEL` is not set, it defaults to `info` in production and `debug` in development
- `NODE_ENV` affects default log level and pretty printing behavior
- All environment variables can be overridden by `initLogger()` options
- Validation limits help prevent memory issues and DoS attacks
- Telemetry TTL and cleanup prevent memory leaks in long-running processes

### Default Redaction Paths

The following fields are automatically redacted:

- `password`, `*.password`, `*.*.password`
- `creditCard`, `*.creditCard`, `*.*.creditCard`
- `auth`, `*.auth`, `*.*.auth`
- `authorization`, `*.authorization`, `*.*.authorization`
- `cookie`, `*.cookie`, `*.*.cookie`
- `token`, `*.token`, `*.*.token`
- `apiKey`, `*.apiKey`, `*.*.apiKey`
- `secret`, `*.secret`, `*.*.secret`
- `ssn`, `*.ssn`, `*.*.ssn`

### Validation Limits

Security and performance limits:

- **Message Length**: 10,000 characters (truncated with ellipsis)
- **Metadata Size**: 1 MB (rejected if exceeded)
- **Context Fields**: 50 fields maximum (extras ignored)
- **Trace Context TTL**: 5 minutes (auto-cleanup)
- **Max Trace Contexts**: 10,000 (LRU eviction)

## Performance

- **Pino Foundation**: Built on one of the fastest Node.js loggers
- **Fast Redaction**: ~2% overhead for non-wildcard paths
- **Efficient Mixin**: Trace context injection via Pino's native mixin
- **Lazy Evaluation**: Metadata validated only when logged
- **Optimized Serialization**: Custom error serializer with minimal overhead

## Examples

### Express.js Integration

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

### Background Job Processing

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

## Author

0xstern ([@mrstern\_](https://twitter.com/mrstern_))

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/0xstern/stern-logger).
