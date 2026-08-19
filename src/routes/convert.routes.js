/**
 * routes/convert.routes.js
 * POST /api/convert
 *
 * Accepts a single PDF upload, validates it, creates a job record, and
 * kicks off the Adobe conversion asynchronously so the HTTP request does not
 * stay open for the full conversion time. Returns immediately with a jobId
 * that the plugin then polls via GET /api/status/:jobId.
 *
 * OCR NOTE: whether OCR runs is controlled by the "ocrEnabled" field sent by
 * the WordPress plugin (mirroring the admin setting "Enable/disable
 * scanned-document OCR"), falling back to the backend's OCR_ENABLED env
 * default if the field is omitted. Adobe PDF Services does not provide a
 * built-in "auto-detect scanned vs text PDF" operation, so this is a global
 * toggle rather than automatic per-file detection - see adobeService.js for
 * the two-step OCR-then-export pipeline this triggers.
 */

'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { upload } = require('../middleware/upload');
const { convertLimiter } = require('../middleware/rateLimiter');
const { requireSharedSecret } = require('../middleware/auth');
const { validatePdf, ValidationError } = require('../services/fileValidator');
const { convertPdfToDocx } = require('../services/adobeService');
const { saveJob, getJob } = require('../services/jobStore');
const { generateJobId, generateDownloadToken } = require('../utils/idGenerator');
const { sanitizeFilename } = require('../utils/sanitizeFilename');
const { config } = require('../config/env');
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

router.post(
  '/convert',
  requireSharedSecret,
  convertLimiter,
  upload.single('file'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_FILE_TYPE',
        message: 'Only genuine PDF files are accepted.'
      });
    }

    try {
      const { fileSizeBytes, pageCount } = await validatePdf(req.file);

      const jobId = generateJobId();
      const downloadToken = generateDownloadToken();
      const outputFilename = sanitizeFilename(req.body.originalFilename || req.file.originalname);
      const outputPath = path.join(config.tempDir, `${jobId}.docx`);

      const useOcr =
        req.body.ocrEnabled !== undefined
          ? req.body.ocrEnabled === 'true'
          : config.ocrEnabled;

      const now = Date.now();
      const job = {
        id: jobId,
        status: 'processing',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + config.fileExpiryMinutes * 60 * 1000).toISOString(),
        inputPath: req.file.path,
        outputPath,
        outputFilename,
        downloadToken,
        downloaded: false,
        fileSizeBytes,
        pageCount,
        errorCode: null
      };

      await saveJob(job);

      logger.info('Conversion job started', { jobId, fileSizeBytes, pageCount, status: 'processing' });

      // Respond immediately; conversion continues in the background.
      res.status(202).json({
        success: true,
        jobId,
        status: 'processing'
      });

      // Fire-and-forget async conversion. Errors are caught and stored on
      // the job record so the status endpoint can report them.
      convertPdfToDocx(req.file.path, outputPath, {
        useOcr,
        ocrLocale: config.ocrLocale,
        jobId
      })
        .then(async () => {
          const current = getJob(jobId);
          if (!current) return;
          current.status = 'completed';
          await saveJob(current);
          safeUnlink(req.file.path);
          logger.info('Conversion job completed', { jobId, status: 'completed' });
        })
        .catch(async (err) => {
          const current = getJob(jobId);
          if (!current) return;
          current.status = 'failed';
          current.errorCode = err.message || 'CONVERSION_FAILED';
          await saveJob(current);
          safeUnlink(req.file.path);
          logger.error('Conversion job failed', { jobId, errorCode: current.errorCode, status: 'failed' });
        });
    } catch (err) {
      safeUnlink(req.file.path);
      if (err instanceof ValidationError) {
        return res.status(400).json({ success: false, errorCode: err.code, message: err.message });
      }
      next(err);
    }
  }
);

module.exports = router;
