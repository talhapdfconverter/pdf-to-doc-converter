/**
 * config/env.js
 *
 * Loads environment variables from .env (via dotenv) and validates that every
 * required variable is present before the server starts. Failing fast here
 * prevents the app from booting into a half-configured, insecure state.
 */

'use strict';

require('dotenv').config();

const REQUIRED_VARS = [
  'PDF_SERVICES_CLIENT_ID',
  'PDF_SERVICES_CLIENT_SECRET',
  'PLUGIN_SHARED_SECRET',
  'ALLOWED_ORIGINS'
];

function requireEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      'Copy .env.example to .env and fill in real values.'
    );
  }
  return value;
}

function validateStartup() {
  const missing = REQUIRED_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[FATAL] Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill in real values before starting the server.'
    );
    process.exit(1);
  }

  if (process.env.PLUGIN_SHARED_SECRET.length < 16) {
    // eslint-disable-next-line no-console
    console.error(
      '[FATAL] PLUGIN_SHARED_SECRET is too short. Use at least 32 random characters.'
    );
    process.exit(1);
  }
}

const config = {
  adobe: {
    clientId: () => requireEnv('PDF_SERVICES_CLIENT_ID'),
    clientSecret: () => requireEnv('PDF_SERVICES_CLIENT_SECRET')
  },
  pluginSharedSecret: requireEnv('PLUGIN_SHARED_SECRET', ''),
  allowedOrigins: requireEnv('ALLOWED_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxFileSizeMb: parseInt(requireEnv('MAX_FILE_SIZE_MB', '25'), 10),
  maxPdfPages: parseInt(requireEnv('MAX_PDF_PAGES', '200'), 10),
  ocrEnabled: requireEnv('OCR_ENABLED', 'true') === 'true',
  ocrLocale: requireEnv('OCR_LOCALE', 'EN_US'),
  fileExpiryMinutes: parseInt(requireEnv('FILE_EXPIRY_MINUTES', '30'), 10),
  port: parseInt(requireEnv('PORT', '8080'), 10),
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  tempDir: require('path').join(__dirname, '..', 'temp')
};

module.exports = { config, validateStartup };
