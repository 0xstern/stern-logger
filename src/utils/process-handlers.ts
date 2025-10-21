/**
 * @fileoverview Process-level exception and rejection handlers
 *
 * Provides utilities for registering handlers for uncaught exceptions and
 * unhandled promise rejections, with dedicated logging to separate files.
 */

import type { Logger } from '../types';

import { join } from 'node:path';

import pino from 'pino';

import { setupLogDirectory } from './directory';

/**
 * Handler function references for cleanup
 */
interface HandlerRefs {
  uncaughtException: ((error: Error) => void) | null;
  unhandledRejection: ((reason: unknown) => void) | null;
}

const handlerRefs: HandlerRefs = {
  uncaughtException: null,
  unhandledRejection: null,
};

/**
 * Creates a logger instance for exception/rejection logging
 *
 * @param logPath - Path to the log file
 * @param level - Log level to use
 * @returns Configured logger instance
 */
function createExceptionLogger(logPath: string, level: string): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-roll',
      options: {
        file: logPath,
        frequency: 'daily',
        size: '10m',
        limit: {
          count: 14,
        },
      },
    },
  });
}

/**
 * Registers process-level exception and rejection handlers
 *
 * This function sets up handlers for uncaught exceptions and unhandled
 * promise rejections. These handlers will log errors to separate files
 * (exceptions.log and rejections.log) to aid in debugging production issues.
 *
 * IMPORTANT: This function does not call process.exit(). The process will
 * crash naturally after logging, which is the correct behavior for
 * uncaught exceptions.
 *
 * @param logger - Logger instance for additional context logging
 * @param logDir - Optional directory for exception logs. If not provided,
 *                 errors will be logged to the main logger only.
 *
 * @example
 * ```typescript
 * import { initLogger, registerProcessHandlers } from 'stern-logger';
 *
 * const logger = await initLogger({ logDir: './logs' });
 * registerProcessHandlers(logger, './logs');
 * ```
 */
export function registerProcessHandlers(logger: Logger, logDir?: string): void {
  // Clean up any existing handlers first
  unregisterProcessHandlers();

  let exceptionsLogger: pino.Logger | null = null;
  let rejectionsLogger: pino.Logger | null = null;

  // Set up file logging if directory provided
  if (logDir != null && logDir.length > 0) {
    try {
      setupLogDirectory(logDir);

      const exceptionsPath = join(logDir, 'exceptions.log');
      const rejectionsPath = join(logDir, 'rejections.log');

      exceptionsLogger = createExceptionLogger(exceptionsPath, 'error');
      rejectionsLogger = createExceptionLogger(rejectionsPath, 'error');
    } catch (error) {
      logger.error(
        { err: error },
        'Failed to setup exception logging directory. ' +
          'Exception/rejection logs will only go to main logger.',
      );
    }
  }

  // Register uncaughtException handler
  const uncaughtExceptionHandler = (error: Error): void => {
    // Log to main logger
    logger.fatal({ err: error }, 'Uncaught exception - process will terminate');

    // Log to dedicated exceptions file if available
    if (exceptionsLogger != null) {
      exceptionsLogger.fatal(
        {
          err: error,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        'Uncaught exception',
      );
    }

    // Don't call process.exit() - let the process crash naturally
  };

  // Register unhandledRejection handler
  const unhandledRejectionHandler = (reason: unknown): void => {
    // Normalize the rejection reason to an error object
    const error =
      reason instanceof Error
        ? reason
        : new Error(
            typeof reason === 'string'
              ? reason
              : 'Unhandled rejection with non-error reason',
          );

    // Log to main logger
    logger.fatal({ err: error }, 'Unhandled promise rejection');

    // Log to dedicated rejections file if available
    if (rejectionsLogger != null) {
      rejectionsLogger.fatal(
        {
          err: error,
          reason:
            reason instanceof Error
              ? undefined
              : reason != null && typeof reason === 'object'
                ? JSON.stringify(reason)
                : String(reason),
          timestamp: new Date().toISOString(),
        },
        'Unhandled rejection',
      );
    }

    // Don't call process.exit() - let the process crash naturally
  };

  // Store references for cleanup
  handlerRefs.uncaughtException = uncaughtExceptionHandler;
  handlerRefs.unhandledRejection = unhandledRejectionHandler;

  // Register handlers
  process.on('uncaughtException', uncaughtExceptionHandler);
  process.on('unhandledRejection', unhandledRejectionHandler);
}

/**
 * Unregisters process exception and rejection handlers
 *
 * This function removes the handlers registered by registerProcessHandlers.
 * Useful for cleanup during graceful shutdown or in test environments.
 *
 * @example
 * ```typescript
 * import { unregisterProcessHandlers } from 'stern-logger';
 *
 * // During graceful shutdown
 * unregisterProcessHandlers();
 * ```
 */
export function unregisterProcessHandlers(): void {
  if (handlerRefs.uncaughtException != null) {
    process.off('uncaughtException', handlerRefs.uncaughtException);
    handlerRefs.uncaughtException = null;
  }

  if (handlerRefs.unhandledRejection != null) {
    process.off('unhandledRejection', handlerRefs.unhandledRejection);
    handlerRefs.unhandledRejection = null;
  }
}
