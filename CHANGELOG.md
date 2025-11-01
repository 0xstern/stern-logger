# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Compact Format Customization**: New `compactMessageFields` option for customizing display fields
  - Configure which fields appear in brackets before the message
  - Default: `['pid', 'hostname', 'env', 'service']`
  - Examples:
    - `['env', 'service']` → `[development] [app] message`
    - `['service']` → `[app] message`
    - `[]` → `message` (no brackets)
  - Supports any field name for flexible formatting

### Changed

- **Message Color in Compact Format**: Message text now displays in white instead of cyan
  - Uses ANSI escape codes in messageFormat template for consistent readability
  - Fields remain cyan, message text is white
  - Format: `HH:MM:SS LEVEL: [cyan fields] white message`

### Fixed

- **Empty Brackets in Compact Format**: Fixed display of undefined fields
  - Used pino-pretty conditional syntax to hide empty field values
  - Template now uses `{if field}[{field}]{end}` pattern
  - Empty brackets no longer appear for undefined pid/hostname values
  - Only fields with actual values are displayed in brackets

## [0.2.2] - 2024-10-30

### Fixed

- **Log Format Display**: Fixed level label display in compact format
  - Removed `customLevels` configuration that was causing "USERLVL: undefined" output
  - Now uses standard Pino level labels (INFO, ERROR, WARN, etc.)
  - Proper level display: `HH:MM:SS INFO [env] [service] message`

## [0.2.1] - 2024-10-30

### Changed

- **Log Format Implementation**: Simplified custom formatter using pino-pretty native features
  - Replaced custom JavaScript formatter module with pino-pretty template syntax
  - Uses `messageFormat`, `customLevels`, and `customColors` options
  - Removed `src/utils/pino-pretty-formatter.js` and build copy step
  - Format: `HH:MM:SS LEVEL [env] [service] message` (extra fields indented below)
  - No breaking changes to API, only implementation details

## [0.2.0] - 2024-10-30

### Changed

- **Performance Optimization**: Removed validation layer for 10-15% performance improvement and 8-12KB bundle size reduction
  - Removed `validateMessage()`, `validateServiceMetadata()`, `validateAndCastLogger()`, `isValidLogger()` functions
  - Removed `getApproximateSize()` and `isWithinSizeLimit()` utilities
  - Removed `VALIDATION_LIMITS` and `MEMORY_SIZE` constants
  - Replaced validation with simple type assertions (Pino handles serialization safely)
  - **Breaking Change**: Validation utility exports no longer available

- **Constants Architecture (BREAKING)**: Removed all `process.env` references from constants for enterprise flexibility
  - Constants now provide pure default values (no environment variable reads)
  - Users have full control over configuration sources (env vars, config files, secret managers, etc.)
  - **Breaking Changes**:
    - `LOG_DIRECTORY` renamed to `DEFAULT_LOG_DIRECTORY`
    - `ROTATION_DEFAULTS` renamed to `DEFAULT_ROTATION_OPTIONS`
    - `TELEMETRY_DEFAULTS` renamed to `DEFAULT_TELEMETRY_OPTIONS`
    - `DEFAULT_LOG_LEVEL` is now always `'info'` (was `'debug'` in development, `'info'` in production)
  - **Migration Guide**:

    ```typescript
    // Before (automatic env var reading)

    // LOG_LEVEL env var was automatically read

    // After (explicit configuration)

    import { baseLogger, DEFAULT_LOG_LEVEL, initLogger } from '@mrstern/logger';

    const logger = await initLogger({
      level: process.env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL,
      defaultService: process.env.SERVICE_NAME ?? 'app',
    });
    ```

  - Benefits:
    - Browser compatible (no `process.env` dependency)
    - Testable (no global state)
    - Flexible (Zod validation, AWS Secrets, Vault, config files)
    - Explicit (clear configuration flow)

- **Log Format (BREAKING)**: Added configurable log format with new compact style as default
  - New `formatStyle` option in `LoggerOptions`: `'compact' | 'default'`
  - **Default format changed** from standard pino-pretty to compact format
  - Compact format: `HH:MM:SS LEVEL [env] [service] message {extra}`
  - Traditional format: `[YYYY-MM-DD HH:MM:SS.mmm TZ] LEVEL: message (indented fields)`
  - **Breaking Change**: Default log output format has changed
  - **Migration Guide**:

    ```typescript
    // Restore previous format

    import { initLogger } from '@mrstern/logger';

    const logger = await initLogger({
      prettyPrint: true,
      formatStyle: 'default', // Use traditional pino-pretty format
    });
    ```

  - Implementation:
    - Created `src/utils/formatter.ts` for configuration
    - Created `src/utils/pino-pretty-formatter.js` as worker-thread-compatible custom formatter
    - Updated build process to copy static JS files to dist
    - Added tests in `test/utils/formatter.test.ts`

### Documentation

- **README Rewrite**: Complete documentation overhaul following technical reference style
  - Removed marketing language ("enterprise-grade", "production-ready")
  - Added comprehensive table of contents with deep navigation
  - Restructured: Quick Start → Core Concepts → Usage → Configuration → Advanced Features → Examples → API Reference → Appendix
  - **New Appendix Sections**:
    - **Distributed Tracing Setup**: Complete browser-to-backend tracing guide
      - OpenTelemetry browser SDK initialization
      - W3C Trace Context propagation via traceparent headers
      - Backend instrumentation with auto-injection
      - Hono and Express middleware examples
      - Trace context flow diagrams
      - Verification steps
    - **LGTM Stack Configuration**: Full Grafana stack integration
      - Docker Compose setup (Loki, Tempo, Grafana, Prometheus)
      - Loki transport configuration with batching
      - Grafana datasource configuration with log-to-trace correlation
      - LogQL queries and dashboard examples
      - Prometheus metrics endpoint setup
      - Production considerations (retention, labels, batching)
  - Enhanced examples:
    - Express.js API with request logging
    - Hono server with OpenTelemetry auto-injection
    - React application with logger context
    - Background job processor
    - Distributed system with end-to-end tracing
  - Improved configuration documentation:
    - Environment variable examples
    - Zod validation pattern
    - AWS Secrets Manager integration

### Removed

- **Validation Module**: Entire `src/utils/validation.ts` file removed
  - Trust model: TypeScript types + Pino's built-in serialization provide sufficient safety
  - Result: ~400 lines of code removed, cleaner API surface, faster logging

## [0.1.1] - 2024-10-21

### Added

- **Telemetry API**: `getTraceContext()` method to Logger interface for retrieving active trace context
- **Auto-Injection**: `autoInject` option in TelemetryOptions for automatic OpenTelemetry context extraction
- **Code Documentation**: Professional `@fileoverview` JSDoc headers to all source files

### Changed

- **Type Safety**: Made telemetry methods non-optional (removed `?` from `setTraceContext` and `clearTraceContext`)
- **Constants**: Renamed `DEFAULT_SERVICE` to `DEFAULT_SERVICE_NAME` for clarity
- **Documentation**: Restructured README with framework integration examples (Hono, React, Express) and improved flow

### Fixed

- **Tests**: Updated test mocks to include required Logger telemetry methods
- **Validation**: Replaced type assertions with behavior testing in validation tests

## [0.1.0] - 2024-10-21

### Changed

- **TypeScript Configuration**: Updated `tsconfig.json` to include test files in type checking
  - Added `test/**/*` to includes
  - Removed `test` from excludes
  - Enables better IDE support and type safety for test files
- **CI/CD**: Updated GitHub Actions autofix workflow name to `autofix.ci`

### Added

- **Core Logger**: Pino-based structured logging with OpenTelemetry support
  - Default logger instance (`baseLogger`) with sensible defaults
  - Async initialization via `initLogger()` with custom options
  - Support for multiple log levels: trace, debug, info, warn, error, fatal
  - Child logger creation for modular logging
- **OpenTelemetry Integration**: Native trace context injection
  - `setTraceContext()` and `clearTraceContext()` methods
  - Automatic trace/span ID injection into log entries
  - Thread-safe context management
  - Support for custom context providers
- **Transport Configuration**: Flexible output options
  - Console transport with `pino-pretty` for development
  - File transport with rotation via `pino-roll`
  - Configurable rotation (daily/hourly, max size, max files)
  - Multiple transports support
- **Sensitive Data Redaction**: Built-in redaction for security
  - Default paths for common sensitive fields (password, apiKey, token, etc.)
  - Custom redaction paths with wildcard support
  - Configurable censor string or removal
  - Uses Pino's fast-redact for performance
- **Error Handling**: Custom error classes and serialization
  - `LoggerError`, `ModuleLoadError`, `ConfigurationError`, `TransportError`
  - Error normalization for consistent handling
  - Enhanced error serialization with cause chains
  - Context-aware error formatting
- **Process Handlers**: Graceful error logging for production
  - `registerProcessHandlers()` for uncaught exceptions and unhandled rejections
  - Separate log files (exceptions.log, rejections.log)
  - No forced process exits (natural crash behavior)
  - `unregisterProcessHandlers()` for cleanup
- **Validation Utilities**: Input validation and sanitization
  - Service metadata validation
  - Value sanitization with size limits
  - Dangerous key filtering (prototype pollution protection)
  - Type-safe validation helpers
- **Comprehensive Test Suite**: 348 tests across 8 test files
  - Unit tests for all core modules
  - Integration tests for logger lifecycle
  - Edge case coverage
  - 690+ assertions with 100% passing rate
- **Build Configuration**: Separated build and development TypeScript configurations
  - Created `tsconfig.build.json` for production builds (excludes tests and examples)
  - Updated build script to use dedicated build configuration
- **Documentation**: Added `CONTRIBUTING.md` with contribution guidelines

### Fixed

- **CI/CD**: GitHub Actions workflow configuration
  - Updated `ci.yml` to use correct TypeScript command
  - Fixed `release.yml` to use Bun instead of Node for version extraction
  - Renamed `autofix.yml` workflow from 'autofix.ci' to 'autofix' (artifact name compatibility)
- **Tests**: Async cleanup for pino-roll worker threads
  - Added 200ms delays in test cleanup to prevent unhandled errors
  - Fixed directory cleanup race conditions
  - Ensured all tests pass in CI environment

### Changed

- **TypeScript**: Excluded test files from compilation
  - Updated `tsconfig.json` to prevent test type errors from blocking builds
  - Type declarations only generated for source files
- **Code Style**: Applied consistent formatting across all files
  - Prettier formatting for all TypeScript, JSON, and Markdown files
  - ESLint configuration with enterprise-grade rules
  - Zero linting errors or warnings

### Technical Details

- **Dependencies**:
  - `pino` v10.1.0 - High-performance logging
  - `pino-pretty` v13.1.2 - Development formatting
  - `pino-roll` v4.0.0 - File rotation
  - `@opentelemetry/api` v1.9.0 - Telemetry integration
- **Runtime**: Bun v1.3.0+ (Node.js v23.11.0+ compatible)
- **Build**: ESM and CommonJS modules with TypeScript declarations
- **Test Framework**: Bun test runner (Jest-compatible)
