import { DEFAULT_REDACT_PATHS } from '../constants';

/**
 * Pino redaction options interface
 *
 * Pino uses the fast-redact module for high-performance sensitive data redaction.
 * See: https://github.com/pinojs/pino/blob/master/docs/redaction.md
 */
export interface RedactionOptions {
  /**
   * Array of paths to redact. Supports:
   * - Dot notation: 'a.b.c'
   * - Bracket notation: 'a["b-c"].d'
   * - Wildcards: 'a[*].b', 'a.b.*'
   * - Case sensitive
   */
  paths: Array<string>;

  /**
   * String to replace redacted values with (default: '[REDACTED]')
   */
  censor?: string;

  /**
   * If true, removes the key entirely instead of replacing the value
   * (default: false)
   */
  remove?: boolean;
}

/**
 * Creates a redaction paths array for Pino
 *
 * Combines default sensitive field paths with custom paths.
 * Uses Pino's native redaction powered by fast-redact for ~2% overhead.
 *
 * @param customPaths - Additional paths to redact beyond defaults
 * @returns Array of paths to redact
 *
 * @example
 * ```typescript
 * const paths = createRedactionPaths(['customSecret', 'api.key']);
 * // Returns: [...DEFAULT_REDACT_PATHS, 'customSecret', 'api.key']
 * ```
 */
export function createRedactionPaths(
  customPaths?: ReadonlyArray<string>,
): Array<string> {
  if (!customPaths || customPaths.length === 0) {
    return [...DEFAULT_REDACT_PATHS];
  }

  // Combine default and custom paths, removing duplicates
  const allPaths = [...DEFAULT_REDACT_PATHS, ...customPaths];
  return [...new Set(allPaths)];
}

/**
 * Creates Pino redaction options with custom configuration
 *
 * Uses Pino's native redaction (fast-redact module) for secure, high-performance
 * sensitive data removal. Adds ~2% overhead for non-wildcard paths.
 *
 * @param paths - Paths to redact (uses defaults if not provided)
 * @param censor - The value to replace sensitive data with (default: '[REDACTED]')
 * @param remove - If true, removes the key entirely instead of censoring
 * @returns Pino redaction configuration object
 *
 * @example
 * ```typescript
 * // Replace with censor string
 * const options = createRedactionOptions(['password'], '***');
 *
 * // Remove keys entirely
 * const options = createRedactionOptions(['ssn'], undefined, true);
 * ```
 */
export function createRedactionOptions(
  paths?: ReadonlyArray<string>,
  censor = '[REDACTED]',
  remove = false,
): RedactionOptions {
  const config: RedactionOptions = {
    paths: createRedactionPaths(paths),
  };

  if (remove) {
    config.remove = true;
  } else {
    config.censor = censor;
  }

  return config;
}

/**
 * Note: Manual redaction is not needed when using Pino's logger.
 *
 * Pino automatically redacts fields based on the `redact` option using
 * the fast-redact module, which is more performant and supports advanced
 * path syntax including wildcards, bracket notation, and nested paths.
 *
 * If you need to redact data outside of logging, consider using the
 * fast-redact module directly: https://github.com/davidmarkclements/fast-redact
 */
