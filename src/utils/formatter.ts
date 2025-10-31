/**
 * @fileoverview Custom log formatter utilities
 *
 * Provides custom formatting options for pretty printing logs in a compact format
 */

/**
 * Creates custom pino-pretty options for compact log formatting
 *
 * Format: HH:MM:SS LEVEL [env] [service] message
 *
 * Note: Extra fields are displayed on their own lines by pino-pretty
 *
 * @returns Pino-pretty options configuration
 */
export function createCustomPrettyOptions(): Record<string, unknown> {
  return {
    colorize: true,
    translateTime: 'HH:MM:ss',
    ignore: 'pid,hostname',
    messageFormat: '{levelLabel} [{env}] [{service}] {msg}',
    customLevels: {
      10: 'TRACE',
      20: 'DEBUG',
      30: 'INFO',
      40: 'WARN',
      50: 'ERROR',
      60: 'FATAL',
    },
    customColors:
      'trace:gray,debug:blue,info:green,warn:yellow,error:red,fatal:bgRed',
    singleLine: false,
  };
}
