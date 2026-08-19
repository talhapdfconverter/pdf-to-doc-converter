/**
 * middleware/upload.js
 *
 * Configures Multer to accept a single PDF file, store it under a random
 * UUID-based filename (never the original filename, to avoid path/collision
 * issues), and enforce a hard size limit at the multipart-parsing level
 * (before fileValidator.js does deeper structural checks).
 */

'use strict';

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../config/env');

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, config.tempDir);
  },
  filename(req, file, cb) {
    const randomName = `${uuidv4()}.pdf`;
    cb(null, randomName);
  }
});

function fileFilter(req, file, cb) {
  // Quick extension/MIME pre-check. Deep validation (magic bytes, structure,
  // page count, encryption) happens afterward in fileValidator.js.
  const isPdfExtension = path.extname(file.originalname).toLowerCase() === '.pdf';
  const isPdfMime = file.mimetype === 'application/pdf';

  if (!isPdfExtension || !isPdfMime) {
    return cb(new Error('INVALID_FILE_TYPE'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024,
    files: 1
  }
});

module.exports = { upload };
