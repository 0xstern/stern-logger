# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-10-21

### Added

- **Build Configuration**: Separated build and development TypeScript configurations
  - Created `tsconfig.build.json` for production builds (excludes tests and examples)
  - Updated build script to use dedicated build configuration
- **Documentation**: Added `CONTRIBUTING.md` with contribution guidelines

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
