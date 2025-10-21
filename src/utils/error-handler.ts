/**
 * JSON indentation for error formatting
 */
const JSON_INDENT_SPACES = 2;

/**
 * Logger-specific error types for better error handling
 */
export class LoggerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoggerError';
    // Capture stack trace in V8 environments (Node.js, Chrome, etc.)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (Error.captureStackTrace != null) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class ModuleLoadError extends LoggerError {
  constructor(moduleName: string, cause?: unknown) {
    const message = `Failed to load logger module: ${moduleName}`;
    super(message);
    this.name = 'ModuleLoadError';
    this.cause = cause;
  }
}

export class ConfigurationError extends LoggerError {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'ConfigurationError';
    this.cause = cause;
  }
}

export class TransportError extends LoggerError {
  constructor(transportName: string, operationOrCause?: string | unknown) {
    const operation =
      typeof operationOrCause === 'string' ? operationOrCause : 'logging';
    const message = `Error in transport ${transportName} during ${operation}`;
    super(message);
    this.name = 'TransportError';
    this.cause =
      typeof operationOrCause === 'string' ? undefined : operationOrCause;
  }
}

/**
 * Normalizes errors into a consistent format
 * Ensures that errors always have a message and optional stack trace
 * @param error - The error to normalize
 * @returns Normalized Error object
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new Error(`Unknown error: ${JSON.stringify(error)}`);
}

/**
 * Formats an error message with an optional stack trace
 * @param error - The error to format
 * @param context - Optional context information
 * @returns Formatted error message string
 */
export function formatErrorMessage(
  error: unknown,
  context: Record<string, unknown> = {},
): string {
  const normalizedError = normalizeError(error);
  const contextString = Object.keys(context).length
    ? `\nContext: ${JSON.stringify(context, null, JSON_INDENT_SPACES)}`
    : '';

  return `${normalizedError.message}${contextString}`;
}

/**
 * Creates a Pino error serializer that handles various error types
 *
 * Pino's default error serializer is good, but this adds extra safety
 * and handles non-standard error objects.
 *
 * @param err - Error to serialize
 * @returns Serialized error object
 */
export function errorSerializer(err: unknown): Record<string, unknown> {
  if (err == null) {
    return {};
  }

  // Handle standard Error objects
  if (err instanceof Error) {
    return {
      type: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause != null && { cause: errorSerializer(err.cause) }),
    };
  }

  // Handle error-like objects
  if (typeof err === 'object') {
    const errorObj = err as Record<string, unknown>;
    return {
      type: errorObj['name'] ?? 'Error',
      message: errorObj['message'] ?? String(err),
      stack: errorObj['stack'],
      ...(errorObj['cause'] != null && {
        cause: errorSerializer(errorObj['cause']),
      }),
    };
  }

  // Handle primitive error values
  return {
    type: 'Error',
    message: String(err),
  };
}

/**
 * Creates Pino serializers configuration with enhanced error handling
 *
 * @returns Pino serializers object
 */
export function createSerializers(): Record<
  string,
  (value: unknown) => unknown
> {
  return {
    err: errorSerializer,
    error: errorSerializer,
  };
}
