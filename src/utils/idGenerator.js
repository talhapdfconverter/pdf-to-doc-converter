/**
 * utils/idGenerator.js
 *
 * Generates unguessable identifiers:
 * - jobId: a standard UUID v4, used in URLs like /api/status/:jobId
 * - downloadToken: a separate, longer random token required (in addition to
 *   the jobId) to actually download a file. Splitting these means knowing a
 *   jobId alone is not enough to download someone else's document.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function generateJobId() {
  return uuidv4();
}

function generateDownloadToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { generateJobId, generateDownloadToken };
