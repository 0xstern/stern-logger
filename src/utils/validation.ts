import type { Logger as PinoLogger } from 'pino';

import type { Logger, ServiceMetadata, SpanContext } from '../types';

import { MEMORY_SIZE, VALIDATION_LIMITS } from '../constants';

/**
 * Validates and sanitizes a log message
 * @param message - The message to validate
 * @returns Sanitized message
 */
export function validateMessage(message: unknown): string {
  if (message === null || message === undefined) {
    return '';
  }

  const messageStr = String(message);

  if (messageStr.length > VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) {
    return (
      messageStr.slice(0, VALIDATION_LIMITS.MAX_MESSAGE_LENGTH) +
      '... [truncated]'
    );
  }

  return messageStr;
}

/**
 * List of known ServiceMetadata fields
 */
const KNOWN_SERVICE_FIELDS = [
  'service',
  'component',
  'operation',
  'layer',
  'domain',
  'integration',
] as const;

/**
 * Validates and converts a field value to a valid string
 * @param value - The value to validate
 * @returns Valid string or undefined if invalid
 */
function validateFieldValue(value: unknown): string | undefined {
  if (
    typeof value === 'string' &&
    value.length <= VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH
  ) {
    return value;
  }

  if (value != null) {
    const strValue = String(value);
    if (strValue.length <= VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH) {
      return strValue;
    }
  }

  return undefined;
}

/**
 * Processes known ServiceMetadata fields
 * @param meta - The metadata object to process
 * @param validated - The validated metadata object to populate
 * @returns Number of fields added
 */
function processKnownFields(
  meta: Record<string, unknown>,
  validated: ServiceMetadata,
): number {
  let fieldCount = 0;

  for (const field of KNOWN_SERVICE_FIELDS) {
    if (field in meta && fieldCount < VALIDATION_LIMITS.MAX_CONTEXT_FIELDS) {
      const validatedValue = validateFieldValue(meta[field]);
      if (validatedValue !== undefined) {
        validated[field as keyof ServiceMetadata] = validatedValue;
        fieldCount++;
      }
    }
  }

  return fieldCount;
}

/**
 * Processes additional fields not in the known fields list
 * @param meta - The metadata object to process
 * @param validated - The validated metadata object to populate
 * @param currentFieldCount - Current number of fields in validated object
 * @returns Number of additional fields added
 */
function processAdditionalFields(
  meta: Record<string, unknown>,
  validated: ServiceMetadata,
  currentFieldCount: number,
): number {
  let fieldCount = currentFieldCount;

  for (const [key, value] of Object.entries(meta)) {
    if (fieldCount >= VALIDATION_LIMITS.MAX_CONTEXT_FIELDS) {
      break;
    }

    if (
      !KNOWN_SERVICE_FIELDS.includes(
        key as (typeof KNOWN_SERVICE_FIELDS)[number],
      ) &&
      key !== 'spanContext' &&
      isValidKey(key)
    ) {
      const sanitizedValue = sanitizeValue(value);
      if (sanitizedValue !== undefined) {
        validated[key] = sanitizedValue;
        fieldCount++;
      }
    }
  }

  return fieldCount;
}

/**
 * Validates service metadata and applies size limits
 * @param metadata - The metadata to validate
 * @returns Validated and sanitized metadata
 */
export function validateServiceMetadata(metadata: unknown): ServiceMetadata {
  if (metadata == null || typeof metadata !== 'object') {
    return {};
  }

  const meta = metadata as Record<string, unknown>;
  const validated: ServiceMetadata = {};

  // Validate known fields
  const fieldCount = processKnownFields(meta, validated);

  // Handle spanContext separately
  if ('spanContext' in meta && isValidSpanContext(meta['spanContext'])) {
    validated.spanContext = meta['spanContext'] as SpanContext;
  }

  // Add other fields up to the limit
  processAdditionalFields(meta, validated, fieldCount);

  return validated;
}

/**
 * Validates that a Pino logger has the required methods
 * @param logger - The logger to validate
 * @returns True if the logger is valid
 */
export function isValidLogger(logger: unknown): logger is Logger {
  if (logger == null || typeof logger !== 'object') {
    return false;
  }

  const pinoLogger = logger as PinoLogger;

  // Check for required Pino methods
  const requiredMethods = ['info', 'error', 'warn', 'debug', 'child'] as const;
  for (const method of requiredMethods) {
    if (
      typeof (pinoLogger as unknown as Record<string, unknown>)[method] !==
      'function'
    ) {
      return false;
    }
  }

  // Check for required properties
  if (typeof pinoLogger.level !== 'string') {
    return false;
  }

  return true;
}

/**
 * Safely casts a Pino logger to our Logger interface after validation
 * @param logger - The Pino logger to cast
 * @returns Validated Logger instance
 * @throws Error if validation fails
 */
export function validateAndCastLogger(logger: PinoLogger): Logger {
  if (!isValidLogger(logger)) {
    throw new Error('Invalid logger: missing required methods or properties');
  }

  return logger as Logger;
}

/**
 * Validates span context structure
 * @param context - The context to validate
 * @returns True if valid span context
 */
function isValidSpanContext(context: unknown): context is SpanContext {
  if (context == null || typeof context !== 'object') {
    return false;
  }

  const ctx = context as Record<string, unknown>;

  return (
    typeof ctx['traceId'] === 'string' &&
    typeof ctx['spanId'] === 'string' &&
    ctx['traceId'].length > 0 &&
    ctx['spanId'].length > 0 &&
    (ctx['traceFlags'] === undefined ||
      typeof ctx['traceFlags'] === 'string') &&
    (ctx['traceState'] === undefined || typeof ctx['traceState'] === 'string')
  );
}

/**
 * Validates that a key is safe to use
 * @param key - The key to validate
 * @returns True if the key is valid
 */
function isValidKey(key: string): boolean {
  // Check key length and format
  if (
    key.length === 0 ||
    key.length > VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH
  ) {
    return false;
  }

  // Avoid prototype pollution
  if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
    return false;
  }

  // Avoid numeric-only keys that could conflict with array indices
  if (/^\d+$/.test(key)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a string value by truncating if needed
 * @param value - The string to sanitize
 * @returns Sanitized string
 */
function sanitizeString(value: string): string {
  return value.length <= VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH
    ? value
    : value.slice(0, VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH) +
        '... [truncated]';
}

/**
 * Sanitizes an array value by limiting size and sanitizing elements
 * @param value - The array to sanitize
 * @returns Sanitized array or undefined if invalid
 */
function sanitizeArray(value: Array<unknown>): Array<unknown> | undefined {
  const sanitizedArray = value
    .slice(0, MEMORY_SIZE.MAX_ARRAY_LENGTH)
    .map(sanitizeValue);
  return sanitizedArray.every((item) => item !== undefined)
    ? sanitizedArray
    : undefined;
}

/**
 * Sanitizes an object value by converting to JSON and validating size
 * @param value - The object to sanitize
 * @returns Sanitized object or string representation
 */
function sanitizeObject(value: object): unknown {
  try {
    const jsonStr = JSON.stringify(value);
    return jsonStr.length <= VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH
      ? JSON.parse(jsonStr)
      : '[object Object]';
  } catch {
    return '[object Object]';
  }
}

/**
 * Sanitizes a value for safe inclusion in metadata
 * @param value - The value to sanitize
 * @returns Sanitized value or undefined if invalid
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return sanitizeArray(value);
  }

  if (typeof value === 'object') {
    return sanitizeObject(value);
  }

  // For functions, symbols, etc., convert to string representation
  return String(value).slice(0, VALIDATION_LIMITS.MAX_STRING_FIELD_LENGTH);
}

/**
 * Calculates the size of an array recursively
 * @param arr - The array to measure
 * @param visited - Set of visited objects to handle circular references
 * @returns Approximate size in bytes
 */
function getArraySize(arr: Array<unknown>, visited: WeakSet<object>): number {
  if (visited.has(arr)) {
    return 0; // Circular reference, don't count again
  }
  visited.add(arr);
  return arr.reduce(
    (size: number, item) => size + getApproximateSize(item, visited),
    0,
  );
}

/**
 * Calculates the size of an object recursively
 * @param obj - The object to measure
 * @param visited - Set of visited objects to handle circular references
 * @returns Approximate size in bytes
 */
function getObjectSize(obj: object, visited: WeakSet<object>): number {
  if (visited.has(obj)) {
    return 0; // Circular reference, don't count again
  }
  visited.add(obj);

  try {
    let size = 0;
    for (const [key, value] of Object.entries(obj)) {
      size += key.length * MEMORY_SIZE.CHARS_BYTES;
      size += getApproximateSize(value, visited);
    }
    return size;
  } catch {
    // If Object.entries fails, return a reasonable estimate
    return MEMORY_SIZE.FALLBACK_OBJECT_BYTES;
  }
}

/**
 * Calculates the approximate memory size of an object
 * @param obj - The object to measure
 * @param visited - Set of visited objects to handle circular references
 * @returns Approximate size in bytes
 */
export function getApproximateSize(
  obj: unknown,
  visited = new WeakSet(),
): number {
  if (obj === null || obj === undefined) {
    return 0;
  }

  if (typeof obj === 'string') {
    return obj.length * MEMORY_SIZE.CHARS_BYTES;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return MEMORY_SIZE.PRIMITIVE_BYTES;
  }

  if (Array.isArray(obj)) {
    return getArraySize(obj, visited);
  }

  if (typeof obj === 'object') {
    return getObjectSize(obj, visited);
  }

  return String(obj).length * MEMORY_SIZE.CHARS_BYTES;
}

/**
 * Ensures metadata doesn't exceed size limits
 * @param metadata - The metadata to check
 * @returns True if within limits
 */
export function isWithinSizeLimit(metadata: unknown): boolean {
  return getApproximateSize(metadata) <= VALIDATION_LIMITS.MAX_META_SIZE;
}
