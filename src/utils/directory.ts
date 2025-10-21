/**
 * @fileoverview Log directory setup and validation
 *
 * Provides utilities for creating and validating log directories,
 * ensuring proper file system permissions before writing log files.
 */

import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { ConfigurationError } from './error-handler';

/**
 * Validates and sets up a log directory
 *
 * This function ensures the directory exists and is writable before
 * attempting to write log files. It will create the directory if it
 * doesn't exist.
 *
 * @param dirPath - Path to the log directory
 * @throws {ConfigurationError} If directory path is invalid or not writable
 *
 * @example
 * ```typescript
 * import { setupLogDirectory } from 'stern-logger';
 *
 * // Ensure log directory exists and is writable
 * setupLogDirectory('./logs');
 * ```
 */
export function setupLogDirectory(dirPath: string): void {
  // Validate input
  if (typeof dirPath !== 'string' || dirPath.trim().length === 0) {
    throw new ConfigurationError(
      'Log directory path must be a non-empty string',
    );
  }

  const normalizedPath = resolve(dirPath.trim());

  // Check if path exists
  if (existsSync(normalizedPath)) {
    // Path exists - verify it's writable
    try {
      accessSync(normalizedPath, constants.W_OK);
    } catch (error) {
      throw new ConfigurationError(
        `Log directory exists but is not writable: ${normalizedPath}`,
        error,
      );
    }
  } else {
    // Path doesn't exist - create it
    try {
      mkdirSync(normalizedPath, { recursive: true });
    } catch (error) {
      throw new ConfigurationError(
        `Failed to create log directory: ${normalizedPath}`,
        error,
      );
    }

    // Verify creation was successful and directory is writable
    try {
      accessSync(normalizedPath, constants.W_OK);
    } catch (error) {
      throw new ConfigurationError(
        `Created log directory but it is not writable: ${normalizedPath}`,
        error,
      );
    }
  }
}
