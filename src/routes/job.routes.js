/**
 * routes/job.routes.js
 * DELETE /api/job/:jobId
 *
 * Lets the WordPress plugin explicitly ask the backend to delete a job's
 * files immediately (e.g. when the user clicks "Start New Conversion"
 * right after downloading), rather than waiting for the next scheduled
 * cleanup sweep.
 */

'use strict';

const express = require('express');
const fs = require('fs');
const router = express.Router();

const { requireSharedSecret } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { getJob, deleteJob } = require('../services/jobStore');
const logger = require('../utils/logger');

function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_) {
      /* best-effort cleanup */
    }
  }
}

router.delete('/job/:jobId', requireSharedSecret, generalLimiter, async (req, res) => {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      errorCode: 'JOB_NOT_FOUND',
      message: 'This conversion job could not be found. It may have expired.'
    });
  }

  safeUnlink(job.inputPath);
  safeUnlink(job.outputPath);
  await deleteJob(job.id);

  logger.info('Job deleted by request', { jobId: job.id, status: 'deleted' });

  res.status(200).json({ success: true, message: 'Job deleted.' });
});

module.exports = router;
