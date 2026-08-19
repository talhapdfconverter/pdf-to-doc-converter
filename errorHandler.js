/**
 * middleware/errorHandler.js
 *
 * Central Express error handler. Ensures every error response sent to the
 * browser/WordPress is a clean, friendly JSON message with a machine
 * readable errorCode - never a stack trace, file path, or raw exception
 * message from a dependency.
 */

'use strict';

const logger = require('../utils/logger');

const FRIENDLY_MESSAGES = {
  INVALID_FILE_TYPE: 'Only genuine PDF files are accepted.',
  INVALID_PDF_SIGNATURE: 'The uploaded file is not a genuine PDF.',
  EMPTY_FILE: 'The uploaded file is empty.',
  FILE_TOO_LARGE: 'The uploaded file is too large.',
  CORRUPTED_PDF: 'The PDF file appears to be corrupted and could not be processed.',
  PASSWORD_PROTECTED: 'This PDF is password-protected and cannot be converted.',
  TOO_MANY_PAGES: 'This PDF has more pages than allowed.',
  ADOBE_SERVICE_ERROR: 'The conversion service encountered an error. Please try again shortly.',
  ADOBE_QUOTA_EXCEEDED: 'The conversion service is temporarily unavailable due to usage limits. Please try again later.',
  ADOBE_SDK_ERROR: 'The conversion service could not process this file.',
  CONVERSION_FAILED: 'This document could not be converted. Please try a different file.',
  JOB_NOT_FOUND: 'This conversion job could not be found. It may have expired.',
  DOWNLOAD_EXPIRED: 'This download link has expired.',
  UNAUTHORIZED: 'Request could not be authenticated.',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',
  UNSUPPORTED_DOCUMENT: 'This type of document is not supported for conversion.',
  LIMIT_FILE_SIZE: 'The uploaded file exceeds the maximum allowed size.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.'
};

function friendlyMessageFor(code) {
  return FRIENDLY_MESSAGES[code] || FRIENDLY_MESSAGES.INTERNAL_ERROR;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let errorCode = 'INTERNAL_ERROR';
  let statusCode = 500;

  if (err.code === 'LIMIT_FILE_SIZE') {
    errorCode = 'LIMIT_FILE_SIZE';
    statusCode = 413;
  } else if (err.message && FRIENDLY_MESSAGES[err.message]) {
    errorCode = err.message;
    statusCode = errorCode === 'UNAUTHORIZED' ? 401 : 400;
  } else if (err.code && FRIENDLY_MESSAGES[err.code]) {
    errorCode = err.code;
    statusCode = 400;
  }

  logger.error('Request failed', {
    route: req.originalUrl,
    method: req.method,
    statusCode,
    errorCode
  });

  res.status(statusCode).json({
    success: false,
    errorCode,
    message: friendlyMessageFor(errorCode)
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: 'This endpoint does not exist.'
  });
}

module.exports = { errorHandler, notFoundHandler, friendlyMessageFor };
