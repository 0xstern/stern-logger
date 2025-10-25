/**
 * @fileoverview Browser entry point for stern-logger
 *
 * Provides lightweight browser-compatible logging with:
 * - Console output for development
 * - Remote endpoint batching for production
 * - LocalStorage buffering for offline support
 * - Sentry integration for error tracking
 * - Type-safe API matching Node.js version
 */

export {
  BrowserLogger,
  baseBrowserLogger,
  initBrowserLogger,
  type BrowserLogLevel,
  type BrowserLoggerOptions,
} from './logger';

// Re-export shared types
export type { SpanContext } from '../types';
