/**
 * routes/status.routes.js
 * GET /api/status/:jobId
 *
 * Returns the current status of a conversion job so the WordPress plugin
 * can poll it while the user sees a progress indicator. Does not return the
 * download token by itself here to keep the two capabilities (checking
 * status vs. downloading) separately auditable, but does return whether a
 * download is ready.
 */

'use strict';

const express = require('express');
const router = express.Router();

const { requireSharedSecret } = require('../middleware/auth');
const { generalLimiter } = require('../middleware/rateLimiter');
const { getJob } = require('../services/jobStore');

router.get('/status/:jobId', requireSharedSecret, generalLimiter, (req, res) => {
  const job = getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      errorCode: 'JOB_NOT_FOUND',
      message: 'This conversion job could not be found. It may have expired.'
    });
  }

  const response = {
    success: true,
    jobId: job.id,
    status: job.status,
    pageCount: job.pageCount
  };

  if (job.status === 'completed') {
    response.downloadToken = job.downloadToken;
    response.filename = job.outputFilename;
  }

  if (job.status === 'failed') {
    response.errorCode = job.errorCode;
  }

  res.status(200).json(response);
});

module.exports = router;
