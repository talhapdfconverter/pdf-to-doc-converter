/**
 * utils/logger.js
 *
 * Minimal structured logger. Deliberately does NOT accept free-form objects
 * that could accidentally contain secrets or file contents - callers must
 * pass only the specific safe fields listed below. This is a guardrail, not
 * just a formatting choice: it makes it structurally hard to leak a secret
 * into the logs by accident.
 */

'use strict';

const SAFE_FIELDS = [
  'jobId',
  'route',
  'method',
  'statusCode',
  'durationMs',
  'fileSizeBytes',
  'pageCount',
  'status',
  'errorCode',
  'ip'
];

function sanitize(fields = {}) {
  const safe = {};
  for (const key of SAFE_FIELDS) {
    if (fields[key] !== undefined) safe[key] = fields[key];
  }
  return safe;
}

function log(level, message, fields) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitize(fields)
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

module.exports = {
  info: (message, fields) => log('info', message, fields),
  warn: (message, fields) => log('warn', message, fields),
  error: (message, fields) => log('error', message, fields)
};
