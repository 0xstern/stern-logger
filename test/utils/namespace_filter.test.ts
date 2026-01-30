/**
 * Tests for namespace filtering utilities
 *
 * Validates namespace pattern parsing, namespace building from metadata,
 * and namespace matching logic for log filtering.
 */

import { afterEach, describe, expect, test } from 'bun:test';

import {
  buildNamespace,
  clearNamespaceCache,
  isNamespaceEnabled,
  parseNamespacePatterns,
} from '../../src/utils/namespace_filter';

describe('Namespace Filter Utilities', () => {
  // Clear cache after each test to ensure isolation
  afterEach(() => {
    clearNamespaceCache();
  });

  describe('parseNamespacePatterns', () => {
    test('should handle wildcard pattern "*"', () => {
      const config = parseNamespacePatterns('*');

      expect(config.patterns).toBe('*');
      expect(config.matchers).toEqual([]);
    });

    test('should handle empty string', () => {
      const config = parseNamespacePatterns('');

      expect(config.patterns).toBe('');
      expect(config.matchers).toEqual([]);
    });

    test('should handle whitespace-only string', () => {
      const config = parseNamespacePatterns('   ');

      expect(config.patterns).toBe('');
      expect(config.matchers).toEqual([]);
    });

    test('should parse single pattern', () => {
      const config = parseNamespacePatterns('voice:*');

      expect(config.patterns).toBe('voice:*');
      expect(config.matchers).toHaveLength(1);
    });

    test('should parse multiple comma-separated patterns', () => {
      const config = parseNamespacePatterns('voice:*,http:*,twilio:*');

      expect(config.patterns).toBe('voice:*,http:*,twilio:*');
      expect(config.matchers).toHaveLength(3);
    });

    test('should trim whitespace around patterns', () => {
      const config = parseNamespacePatterns('  voice:*  ,  http:*  ');

      expect(config.matchers).toHaveLength(2);
    });

    test('should filter empty patterns from comma-separated string', () => {
      const config = parseNamespacePatterns('voice:*,,http:*,');

      expect(config.matchers).toHaveLength(2);
    });

    test('should cache parsed configurations', () => {
      const config1 = parseNamespacePatterns('voice:*');
      const config2 = parseNamespacePatterns('voice:*');

      expect(config1).toBe(config2);
    });

    test('should return different configs for different patterns', () => {
      const config1 = parseNamespacePatterns('voice:*');
      const config2 = parseNamespacePatterns('http:*');

      expect(config1).not.toBe(config2);
    });

    test('should escape regex special characters', () => {
      const config = parseNamespacePatterns('api.v1.user');

      // Should match literal "api.v1.user", not "apixv1xuser"
      expect(config.matchers[0]?.test('api.v1.user')).toBe(true);
      expect(config.matchers[0]?.test('apixv1xuser')).toBe(false);
    });

    test('should handle patterns with special regex characters', () => {
      const config = parseNamespacePatterns('api[v1]+auth');

      expect(config.matchers[0]?.test('api[v1]+auth')).toBe(true);
    });
  });

  describe('buildNamespace', () => {
    test('should build namespace from component and layer', () => {
      const namespace = buildNamespace({
        component: 'voice',
        layer: 'orchestrator',
      });

      expect(namespace).toBe('voice:orchestrator');
    });

    test('should build namespace from component and operation', () => {
      const namespace = buildNamespace({
        component: 'http',
        operation: 'request',
      });

      expect(namespace).toBe('http:request');
    });

    test('should build namespace from component and domain', () => {
      const namespace = buildNamespace({
        component: 'api',
        domain: 'users',
      });

      expect(namespace).toBe('api:users');
    });

    test('should prefer layer over operation over domain', () => {
      const namespace = buildNamespace({
        component: 'api',
        layer: 'controller',
        operation: 'create',
        domain: 'users',
      });

      expect(namespace).toBe('api:controller');
    });

    test('should fall back to service if no component', () => {
      const namespace = buildNamespace({
        service: 'api',
      });

      expect(namespace).toBe('api');
    });

    test('should build namespace from service and layer', () => {
      const namespace = buildNamespace({
        service: 'api',
        layer: 'middleware',
      });

      expect(namespace).toBe('api:middleware');
    });

    test('should append integration suffix', () => {
      const namespace = buildNamespace({
        component: 'voice',
        layer: 'service',
        integration: 'twilio',
      });

      expect(namespace).toBe('voice:service:twilio');
    });

    test('should handle component with integration only', () => {
      const namespace = buildNamespace({
        component: 'email',
        integration: 'ses',
      });

      expect(namespace).toBe('email:ses');
    });

    test('should return empty string for empty metadata', () => {
      const namespace = buildNamespace({});

      expect(namespace).toBe('');
    });

    test('should handle metadata with empty strings', () => {
      const namespace = buildNamespace({
        component: '',
        service: 'api',
        layer: '',
        operation: 'create',
      });

      expect(namespace).toBe('api:create');
    });

    test('should handle only integration without primary identifier', () => {
      const namespace = buildNamespace({
        integration: 'twilio',
      });

      expect(namespace).toBe('twilio');
    });
  });

  describe('isNamespaceEnabled', () => {
    test('should return true for wildcard pattern', () => {
      const config = parseNamespacePatterns('*');

      expect(isNamespaceEnabled('anything', config)).toBe(true);
      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('', config)).toBe(true);
    });

    test('should return true for empty pattern', () => {
      const config = parseNamespacePatterns('');

      expect(isNamespaceEnabled('anything', config)).toBe(true);
    });

    test('should match exact namespace', () => {
      const config = parseNamespacePatterns('voice:orchestrator');

      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('voice:service', config)).toBe(false);
    });

    test('should match glob pattern with wildcard suffix', () => {
      const config = parseNamespacePatterns('voice:*');

      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('voice:service', config)).toBe(true);
      expect(isNamespaceEnabled('voice:', config)).toBe(true);
      expect(isNamespaceEnabled('http:request', config)).toBe(false);
    });

    test('should match glob pattern with wildcard prefix', () => {
      const config = parseNamespacePatterns('*:orchestrator');

      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('api:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('voice:service', config)).toBe(false);
    });

    test('should match multiple patterns', () => {
      const config = parseNamespacePatterns('voice:*,http:*');

      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(true);
      expect(isNamespaceEnabled('http:request', config)).toBe(true);
      expect(isNamespaceEnabled('twilio:handler', config)).toBe(false);
    });

    test('should match pattern with embedded wildcard', () => {
      const config = parseNamespacePatterns('voice:*:twilio');

      expect(isNamespaceEnabled('voice:service:twilio', config)).toBe(true);
      expect(isNamespaceEnabled('voice:handler:twilio', config)).toBe(true);
      expect(isNamespaceEnabled('voice:service:gemini', config)).toBe(false);
    });

    test('should handle single word namespaces', () => {
      const config = parseNamespacePatterns('api');

      expect(isNamespaceEnabled('api', config)).toBe(true);
      expect(isNamespaceEnabled('api:service', config)).toBe(false);
    });

    test('should handle service-level wildcard', () => {
      const config = parseNamespacePatterns('api*');

      expect(isNamespaceEnabled('api', config)).toBe(true);
      expect(isNamespaceEnabled('api:service', config)).toBe(true);
      expect(isNamespaceEnabled('api-client', config)).toBe(true);
    });
  });

  describe('clearNamespaceCache', () => {
    test('should clear cached configurations', () => {
      const config1 = parseNamespacePatterns('voice:*');
      clearNamespaceCache();
      const config2 = parseNamespacePatterns('voice:*');

      // Should be different object references after cache clear
      expect(config1).not.toBe(config2);
    });

    test('should allow re-parsing same patterns after clear', () => {
      parseNamespacePatterns('http:*');
      clearNamespaceCache();

      // Should not throw
      const config = parseNamespacePatterns('http:*');
      expect(config.matchers).toHaveLength(1);
    });
  });

  describe('Integration Tests', () => {
    test('should work end-to-end with metadata', () => {
      const config = parseNamespacePatterns('voice:*');
      const namespace = buildNamespace({
        component: 'voice',
        layer: 'orchestrator',
      });

      expect(isNamespaceEnabled(namespace, config)).toBe(true);
    });

    test('should filter out non-matching namespaces', () => {
      const config = parseNamespacePatterns('voice:*');
      const namespace = buildNamespace({
        component: 'http',
        operation: 'request',
      });

      expect(isNamespaceEnabled(namespace, config)).toBe(false);
    });

    test('should work with multiple component patterns', () => {
      const config = parseNamespacePatterns('voice:*,twilio:*,gemini:*');

      const voiceNs = buildNamespace({ component: 'voice', layer: 'service' });
      const twilioNs = buildNamespace({
        component: 'twilio',
        layer: 'handler',
      });
      const httpNs = buildNamespace({ component: 'http', operation: 'get' });

      expect(isNamespaceEnabled(voiceNs, config)).toBe(true);
      expect(isNamespaceEnabled(twilioNs, config)).toBe(true);
      expect(isNamespaceEnabled(httpNs, config)).toBe(false);
    });

    test('should handle real-world namespace patterns', () => {
      const config = parseNamespacePatterns(
        'voice:orchestrator,voice:service,http:*',
      );

      expect(
        isNamespaceEnabled(
          buildNamespace({ component: 'voice', layer: 'orchestrator' }),
          config,
        ),
      ).toBe(true);

      expect(
        isNamespaceEnabled(
          buildNamespace({ component: 'voice', layer: 'service' }),
          config,
        ),
      ).toBe(true);

      expect(
        isNamespaceEnabled(
          buildNamespace({ component: 'voice', layer: 'handler' }),
          config,
        ),
      ).toBe(false);

      expect(
        isNamespaceEnabled(
          buildNamespace({ component: 'http', operation: 'request' }),
          config,
        ),
      ).toBe(true);
    });

    test('should work with service-based namespaces', () => {
      const config = parseNamespacePatterns('api:*,workers:*');

      expect(
        isNamespaceEnabled(
          buildNamespace({ service: 'api', layer: 'controller' }),
          config,
        ),
      ).toBe(true);

      expect(
        isNamespaceEnabled(
          buildNamespace({ service: 'workers', operation: 'process' }),
          config,
        ),
      ).toBe(true);

      expect(
        isNamespaceEnabled(
          buildNamespace({ service: 'db', layer: 'query' }),
          config,
        ),
      ).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long patterns', () => {
      const longPattern = 'a:'.repeat(50) + '*';
      const config = parseNamespacePatterns(longPattern);

      expect(config.matchers).toHaveLength(1);
    });

    test('should handle many patterns', () => {
      const manyPatterns = Array.from(
        { length: 100 },
        (_, i) => `component${i}:*`,
      ).join(',');
      const config = parseNamespacePatterns(manyPatterns);

      expect(config.matchers).toHaveLength(100);
    });

    test('should handle unicode in patterns', () => {
      const config = parseNamespacePatterns('日本語:*');

      expect(isNamespaceEnabled('日本語:test', config)).toBe(true);
    });

    test('should handle colons in patterns correctly', () => {
      const config = parseNamespacePatterns('a:b:c:*');

      expect(isNamespaceEnabled('a:b:c:d', config)).toBe(true);
      expect(isNamespaceEnabled('a:b:x:d', config)).toBe(false);
    });

    test('should handle multiple wildcards in pattern', () => {
      const config = parseNamespacePatterns('*:*:twilio');

      expect(isNamespaceEnabled('voice:service:twilio', config)).toBe(true);
      expect(isNamespaceEnabled('api:handler:twilio', config)).toBe(true);
      expect(isNamespaceEnabled('voice:service:gemini', config)).toBe(false);
    });

    test('should handle pattern that is just wildcard suffix', () => {
      const config = parseNamespacePatterns('*:*');

      expect(isNamespaceEnabled('any:thing', config)).toBe(true);
      expect(isNamespaceEnabled('single', config)).toBe(false);
    });

    test('should handle empty namespace string', () => {
      const config = parseNamespacePatterns('voice:*');

      expect(isNamespaceEnabled('', config)).toBe(false);
    });

    test('should not match partial namespace without wildcard', () => {
      const config = parseNamespacePatterns('voice');

      expect(isNamespaceEnabled('voice', config)).toBe(true);
      expect(isNamespaceEnabled('voice:orchestrator', config)).toBe(false);
      expect(isNamespaceEnabled('voicemail', config)).toBe(false);
    });
  });
});
