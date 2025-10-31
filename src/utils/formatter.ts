/**
 * @fileoverview Custom log formatter utilities
 *
 * Provides custom formatting options for pretty printing logs in a compact format
 */

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Creates custom pino-pretty options for compact log formatting
 *
 * Format: HH:MM:SS LEVEL [env] [service] message {extra: "fields"}
 *
 * @returns Pino-pretty options configuration
 */
export function createCustomPrettyOptions(): Record<string, unknown> {
  // Get the path to the custom formatter module
  const formatterPath = join(
    fileURLToPath(new URL('.', import.meta.url)),
    'pino-pretty-formatter.js',
  );

  return {
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname,level',
    messageFormat: formatterPath,
  };
}
