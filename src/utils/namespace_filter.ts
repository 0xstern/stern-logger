/**
 * @fileoverview Namespace-based log filtering
 *
 * Provides utilities for filtering logs by namespace patterns.
 * Enables selective log output based on component/layer hierarchy.
 *
 * @example
 * ```bash
 * # Only voice-related logs
 * LOG_NAMESPACES=voice:* bun run dev
 *
 * # Voice and twilio logs
 * LOG_NAMESPACES=voice:*,twilio:* bun run dev
 *
 * # All logs (default)
 * LOG_NAMESPACES=* bun run dev
 * ```
 */

import type { ServiceMetadata } from '../types';

/**
 * Configuration for namespace filtering
 */
export interface NamespaceConfig {
  /**
   * Comma-separated namespace patterns
   * @example "voice:*,twilio:*"
   */
  readonly patterns: string;

  /**
   * Compiled RegExp patterns for matching
   */
  readonly matchers: ReadonlyArray<RegExp>;
}

/** Cache for compiled namespace configs */
const configCache = new Map<string, NamespaceConfig>();

/**
 * Parse a namespace pattern string into RegExp matchers.
 *
 * Supports glob patterns:
 * - `*` matches everything
 * - `voice:*` matches voice:orchestrator, voice:service, etc.
 * - `voice:orchestrator` matches exactly that namespace
 *
 * @param patterns - Comma-separated namespace patterns
 * @returns Compiled namespace configuration
 *
 * @example
 * ```typescript
 * const config = parseNamespacePatterns('voice:*,http:request');
 * // config.matchers = [/^voice:.*$/, /^http:request$/]
 * ```
 */
export function parseNamespacePatterns(patterns: string): NamespaceConfig {
  // Check cache first
  const cached = configCache.get(patterns);
  if (cached != null) {
    return cached;
  }

  const trimmed = patterns.trim();

  // Handle empty or wildcard patterns
  if (trimmed === '' || trimmed === '*') {
    const config: NamespaceConfig = {
      patterns: trimmed,
      matchers: [],
    };
    configCache.set(patterns, config);
    return config;
  }

  // Parse and compile patterns
  const matchers = trimmed
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
    .map((pattern) => {
      // Escape regex special characters except *
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      // Convert glob * to regex .*
      const regexPattern = escaped.replace(/\*/g, '.*');
      return new RegExp(`^${regexPattern}$`);
    });

  const config: NamespaceConfig = {
    patterns: trimmed,
    matchers,
  };

  configCache.set(patterns, config);
  return config;
}

/**
 * Build a namespace string from service metadata.
 *
 * Uses component and layer/operation to create a hierarchical namespace.
 * Falls back to service if no component is specified.
 *
 * @param metadata - Service metadata from child logger
 * @returns Namespace string (e.g., "voice:orchestrator")
 *
 * @example
 * ```typescript
 * buildNamespace({ component: 'voice', layer: 'orchestrator' });
 * // Returns: "voice:orchestrator"
 *
 * buildNamespace({ service: 'api' });
 * // Returns: "api"
 *
 * buildNamespace({ component: 'http', operation: 'request' });
 * // Returns: "http:request"
 * ```
 */
// Function is cohesive (builds namespace from prioritized fields) - splitting would reduce readability.
// eslint-disable-next-line complexity -- High complexity due to null checks on optional metadata fields.
export function buildNamespace(metadata: ServiceMetadata): string {
  const parts: Array<string> = [];

  // Primary identifier: component or service
  if (metadata.component != null && metadata.component.length > 0) {
    parts.push(metadata.component);
  } else if (metadata.service != null && metadata.service.length > 0) {
    parts.push(metadata.service);
  }

  // Secondary identifier: layer, operation, or domain
  if (metadata.layer != null && metadata.layer.length > 0) {
    parts.push(metadata.layer);
  } else if (metadata.operation != null && metadata.operation.length > 0) {
    parts.push(metadata.operation);
  } else if (metadata.domain != null && metadata.domain.length > 0) {
    parts.push(metadata.domain);
  }

  // Integration suffix for external services
  if (metadata.integration != null && metadata.integration.length > 0) {
    parts.push(metadata.integration);
  }

  return parts.join(':');
}

/**
 * Check if a namespace is enabled based on configured patterns.
 *
 * Returns true if:
 * - No patterns are configured (empty matchers array = all enabled)
 * - The namespace matches any of the configured patterns
 *
 * @param namespace - The namespace to check (e.g., "voice:orchestrator")
 * @param config - The parsed namespace configuration
 * @returns True if the namespace is enabled
 *
 * @example
 * ```typescript
 * const config = parseNamespacePatterns('voice:*');
 *
 * isNamespaceEnabled('voice:orchestrator', config); // true
 * isNamespaceEnabled('voice:service', config);      // true
 * isNamespaceEnabled('http:request', config);       // false
 * ```
 */
export function isNamespaceEnabled(
  namespace: string,
  config: NamespaceConfig,
): boolean {
  // No matchers means all namespaces are enabled (wildcard or empty)
  if (config.matchers.length === 0) {
    return true;
  }

  // Check if namespace matches any pattern
  return config.matchers.some((matcher) => matcher.test(namespace));
}

/**
 * Clear the namespace config cache.
 * Useful for testing or when configuration changes.
 */
export function clearNamespaceCache(): void {
  configCache.clear();
}
