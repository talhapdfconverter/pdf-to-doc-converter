/**
 * services/fileValidator.js
 *
 * Server-side PDF validation. This is the authoritative check - the
 * WordPress plugin also validates on the frontend, but that check exists
 * only to give the user fast feedback and must never be trusted by itself,
 * since client-side checks can always be bypassed.
 */

'use strict';

const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { config } = require('../config/env');

const PDF_MAGIC_BYTES = Buffer.from('%PDF-');

class ValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Reads the first bytes of the file and confirms it starts with the PDF
 * file signature ("%PDF-"). Renamed executables or other binaries will not
 * have this signature even if the extension/MIME type were spoofed.
 */
function checkMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(PDF_MAGIC_BYTES.length);
    fs.readSync(fd, buffer, 0, PDF_MAGIC_BYTES.length, 0);
    if (!buffer.equals(PDF_MAGIC_BYTES)) {
      throw new ValidationError('INVALID_PDF_SIGNATURE', 'The uploaded file is not a genuine PDF.');
    }
  } finally {
    fs.closeSync(fd);
  }
}

function checkFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new ValidationError('EMPTY_FILE', 'The uploaded file is empty.');
  }
  const maxBytes = config.maxFileSizeMb * 1024 * 1024;
  if (stats.size > maxBytes) {
    throw new ValidationError(
      'FILE_TOO_LARGE',
      `The uploaded file exceeds the maximum allowed size of ${config.maxFileSizeMb} MB.`
    );
  }
  return stats.size;
}

function checkMimeType(mimetype) {
  if (mimetype !== 'application/pdf') {
    throw new ValidationError('INVALID_MIME_TYPE', 'The uploaded file must be a PDF document.');
  }
}

/**
 * Attempts to parse the PDF structure with pdf-lib. This catches corrupted
 * files, confirms it is a well-formed PDF, detects password protection, and
 * returns the page count so it can be checked against MAX_PDF_PAGES.
 */
async function checkStructureAndGetPageCount(filePath) {
  const bytes = fs.readFileSync(filePath);
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });

    if (pdfDoc.isEncrypted) {
      throw new ValidationError(
        'PASSWORD_PROTECTED',
        'This PDF is password-protected and cannot be converted. Please remove the password and try again.'
      );
    }

    const pageCount = pdfDoc.getPageCount();
    if (pageCount === 0) {
      throw new ValidationError('CORRUPTED_PDF', 'The PDF appears to have no pages or is corrupted.');
    }
    if (pageCount > config.maxPdfPages) {
      throw new ValidationError(
        'TOO_MANY_PAGES',
        `This PDF has ${pageCount} pages, which exceeds the maximum allowed of ${config.maxPdfPages}.`
      );
    }

    return pageCount;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('CORRUPTED_PDF', 'The uploaded file could not be read as a valid PDF.');
  }
}

/**
 * Runs all validation checks in order. Throws ValidationError with a safe,
 * user-facing message and machine-readable code on the first failure.
 * Returns basic file metadata on success.
 */
async function validatePdf(file) {
  checkMimeType(file.mimetype);
  const fileSizeBytes = checkFileSize(file.path);
  checkMagicBytes(file.path);
  const pageCount = await checkStructureAndGetPageCount(file.path);

  return { fileSizeBytes, pageCount };
}

module.exports = { validatePdf, ValidationError };
