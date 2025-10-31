/**
 * Custom formatter for pino-pretty
 * This file is loaded by pino-pretty in a worker thread
 *
 * Format: HH:MM:SS LEVEL [env] [service] message {extra: "fields"}
 */

const DEFAULT_INFO_LEVEL = 30;

/**
 * Get the log level name from the level number
 * @param {number} level - The log level number
 * @returns {string} The log level name
 */
function getLevelName(level) {
  const FATAL_LEVEL = 60;
  const ERROR_LEVEL = 50;
  const WARN_LEVEL = 40;
  const INFO_LEVEL = 30;
  const DEBUG_LEVEL = 20;
  const TRACE_LEVEL = 10;

  if (level >= FATAL_LEVEL) return 'FATAL';
  if (level >= ERROR_LEVEL) return 'ERROR';
  if (level >= WARN_LEVEL) return 'WARN';
  if (level >= INFO_LEVEL) return 'INFO';
  if (level >= DEBUG_LEVEL) return 'DEBUG';
  if (level >= TRACE_LEVEL) return 'TRACE';
  return 'INFO';
}

/**
 * Extract extra fields from log record (excluding standard fields)
 * @param {object} log - The log object
 * @param {string} messageKey - The message key
 * @returns {object} Extra fields from the log
 */
function getExtraFields(log, messageKey) {
  const standardFields = new Set([
    'level',
    'time',
    'pid',
    'hostname',
    'service',
    'env',
    messageKey,
    'msg',
    'trace_id',
    'span_id',
    'trace_flags',
    'trace_state',
  ]);

  const extraFields = {};
  for (const [key, value] of Object.entries(log)) {
    if (!standardFields.has(key)) {
      extraFields[key] = value;
    }
  }
  return extraFields;
}

/**
 * Custom message formatter for pino-pretty
 * @param {object} log - The log object
 * @param {string} messageKey - The message key
 * @returns {string} Formatted message
 */
module.exports = function (log, messageKey) {
  const msg = log[messageKey];
  const level = log.level ?? DEFAULT_INFO_LEVEL;
  const env = log.env;
  const service = log.service;

  // Map log level numbers to names
  const levelName = getLevelName(level);

  // Build the format: LEVEL [env] [service] message {extra}
  const parts = [];

  if (env !== undefined) {
    parts.push(`[${env}]`);
  }

  if (service !== undefined) {
    parts.push(`[${service}]`);
  }

  const hasMessage = msg !== undefined && msg !== '';
  const extraFields = getExtraFields(log, messageKey);
  const hasExtras = Object.keys(extraFields).length > 0;

  if (hasMessage) {
    parts.push(msg);
  }

  // Add extra fields
  if (hasExtras) {
    parts.push(JSON.stringify(extraFields));
  }

  return `${levelName} ${parts.join(' ')}`;
};
