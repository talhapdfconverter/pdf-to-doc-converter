/**
 * services/cleanupService.js
 *
 * Periodically scans the job store for jobs that have expired (based on
 * FILE_EXPIRY_MINUTES) or were already downloaded (one-time download),
 * deletes their temp files from disk, and removes the job record.
 *
 * This is what fulfils "uploaded files are automatically deleted" and
 * "delete temporary files after download or expiration" from the spec.
 */

'use strict';

const fs = require('fs');
const { listJobs, deleteJob } = require('./jobStore');
const { config } = require('../config/env');
const logger = require('../utils/logger');

function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.warn('Failed to delete temp file during cleanup', { errorCode: 'CLEANUP_UNLINK_FAILED' });
    }
  }
}

function isExpired(job) {
  const expiresAt = new Date(job.expiresAt).getTime();
  return Date.now() > expiresAt;
}

function runCleanup() {
  const jobs = listJobs();
  let cleaned = 0;

  for (const job of jobs) {
    const shouldClean = isExpired(job) || job.downloaded === true;
    if (!shouldClean) continue;

    safeUnlink(job.inputPath);
    safeUnlink(job.outputPath);
    deleteJob(job.id);
    cleaned += 1;
  }

  if (cleaned > 0) {
    logger.info('Cleanup sweep completed', { status: `removed_${cleaned}_jobs` });
  }
}

function startCleanupScheduler() {
  // Run once at startup, then every 5 minutes.
  runCleanup();
  const intervalMs = 5 * 60 * 1000;
  setInterval(runCleanup, intervalMs);
  logger.info('Cleanup scheduler started', { status: `expiry_${config.fileExpiryMinutes}min` });
}

module.exports = { startCleanupScheduler, runCleanup };
