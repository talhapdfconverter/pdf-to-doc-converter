/**
 * routes/download.routes.js
 * GET /api/download/:jobId?token=<downloadToken>
 *
 * Streams the finished DOCX file back to WordPress (which in turn streams it
 * to the browser). Requires BOTH the correct jobId AND a matching download
 * token, so a guessed/incremented jobId alone can never retrieve someone
 * else's file. The file path served is always the one stored on the job
 * record (never built from user-supplied input), which rules out path
 * traversal. One-time download behavior marks the job as downloaded so the
 * next cleanup sweep removes it immediately.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const router = express.Router();

const { requireSharedSecret } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { getJob, saveJob } = require('../services/jobStore');
const logger = require('../utils/logger');

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

router.get('/download/:jobId', requireSharedSecret, generalLimiter, async (req, res) => {
  const job = getJob(req.params.jobId);
  const token = req.query.token;

  if (!job) {
    return res.status(404).json({
      success: false,
      errorCode: 'JOB_NOT_FOUND',
      message: 'This conversion job could not be found. It may have expired.'
    });
  }

  if (!token || !timingSafeEqualStrings(token, job.downloadToken)) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Request could not be authenticated.'
    });
  }

  if (new Date(job.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({
      success: false,
      errorCode: 'DOWNLOAD_EXPIRED',
      message: 'This download link has expired.'
    });
  }

  if (job.status !== 'completed') {
    return res.status(409).json({
      success: false,
      errorCode: 'JOB_NOT_READY',
      message: 'This conversion is not finished yet.'
    });
  }

  if (!fs.existsSync(job.outputPath)) {
    return res.status(404).json({
      success: false,
      errorCode: 'JOB_NOT_FOUND',
      message: 'This file is no longer available.'
    });
  }

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${job.outputFilename}"`);

  const readStream = fs.createReadStream(job.outputPath);
  readStream.on('error', () => {
    res.status(500).end();
  });
  readStream.on('close', async () => {
    job.downloaded = true;
    await saveJob(job);
    logger.info('File downloaded', { jobId: job.id, status: 'downloaded' });
  });

  readStream.pipe(res);
});

module.exports = router;
