/**
 * @fileoverview Custom log formatter utilities
 *
 * Provides custom formatting options for pretty printing logs in a compact format
 */

const DEFAULT_COMPACT_FIELDS = ['pid', 'hostname', 'env', 'service'];

/**
 * Creates custom pino-pretty options for compact log formatting
 *
 * Format: HH:MM:SS LEVEL: [field1] [field2] ... message
 *
 * Note: Extra fields are displayed on their own lines by pino-pretty
 *
 * @param fields - Fields to display in brackets before message
 * @returns Pino-pretty options configuration
 */
export function createCustomPrettyOptions(
  fields: ReadonlyArray<string> = DEFAULT_COMPACT_FIELDS,
): Record<string, unknown> {
  // Build the message format with specified fields
  // Use conditional syntax to hide empty fields
  const fieldPlaceholders = fields
    .map((field) => `{if ${field}}[{${field}}]{end}`)
    .join(' ');

  // ANSI escape codes: \x1b[37m = white, \x1b[39m = reset to default
  const messageFormat =
    fieldPlaceholders.length > 0
      ? `${fieldPlaceholders} \x1b[37m{msg}\x1b[39m`
      : '\x1b[37m{msg}\x1b[39m';

  return {
    colorize: true,
    translateTime: 'HH:MM:ss',
    messageFormat,
  };
}
