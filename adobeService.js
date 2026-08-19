/**
 * services/adobeService.js
 *
 * Wraps the official Adobe PDF Services Node.js SDK (@adobe/pdfservices-node-sdk).
 *
 * IMPORTANT ARCHITECTURE NOTE:
 * Adobe PDF Services exposes PDF-to-DOCX export and OCR as two SEPARATE
 * operations. There is no single "convert scanned PDF to DOCX with OCR"
 * call. So for a scanned/image-only PDF, this service:
 *   1. Runs an OCRJob on the input PDF (adds an invisible, searchable text
 *      layer over the original page images) -> produces an OCR'd PDF.
 *   2. Runs an ExportPDFJob (targetFormat: DOCX) on that OCR'd PDF.
 * For a normal text-based PDF, only step 2 runs.
 *
 * No generative AI model is used anywhere in this file - conversion is
 * performed entirely by Adobe's PDF Services engine.
 */

'use strict';

const fs = require('fs');
const {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExportPDFParams,
  ExportPDFTargetFormat,
  ExportPDFJob,
  ExportPDFResult,
  OCRJob,
  OCRResult,
  OCRParams,
  OCRSupportedLocale,
  OCRSupportedType,
  SDKError,
  ServiceUsageError,
  ServiceApiError
} = require('@adobe/pdfservices-node-sdk');

const { config } = require('../config/env');
const logger = require('../utils/logger');

function getPdfServicesClient() {
  const credentials = new ServicePrincipalCredentials({
    clientId: config.adobe.clientId(),
    clientSecret: config.adobe.clientSecret()
  });
  return new PDFServices({ credentials });
}

/**
 * Runs Adobe's OCR operation on a local PDF file and returns the resulting
 * OCR'd PDF as a Buffer. Uses SEARCHABLE_IMAGE_EXACT so the original page
 * images are kept untouched and only an invisible text layer is added -
 * this preserves visual fidelity for the later DOCX export.
 */
async function ocrPdf(pdfServices, filePath, locale) {
  const readStream = fs.createReadStream(filePath);
  const inputAsset = await pdfServices.upload({ readStream, mimeType: MimeType.PDF });

  const ocrParams = new OCRParams({
    ocrLocale: OCRSupportedLocale[locale] || OCRSupportedLocale.EN_US,
    ocrType: OCRSupportedType.SEARCHABLE_IMAGE_EXACT
  });

  const job = new OCRJob({ inputAsset, params: ocrParams });
  const pollingURL = await pdfServices.submit({ job });
  const response = await pdfServices.getJobResult({ pollingURL, resultType: OCRResult });

  const resultAsset = response.result.asset;
  const streamAsset = await pdfServices.getContent({ asset: resultAsset });
  return streamAsset.readStream;
}

/**
 * Runs Adobe's Export PDF operation to convert a PDF (as a readable stream
 * or file path) into a DOCX file. Returns a readable stream of the DOCX
 * bytes.
 */
async function exportToDocx(pdfServices, source) {
  const readStream = typeof source === 'string' ? fs.createReadStream(source) : source;
  const inputAsset = await pdfServices.upload({ readStream, mimeType: MimeType.PDF });

  const params = new ExportPDFParams({ targetFormat: ExportPDFTargetFormat.DOCX });
  const job = new ExportPDFJob({ inputAsset, params });

  const pollingURL = await pdfServices.submit({ job });
  const response = await pdfServices.getJobResult({ pollingURL, resultType: ExportPDFResult });

  const resultAsset = response.result.asset;
  const streamAsset = await pdfServices.getContent({ asset: resultAsset });
  return streamAsset.readStream;
}

/**
 * Full conversion pipeline for one job.
 *
 * @param {string} inputPath   Path to the temporarily stored input PDF.
 * @param {string} outputPath  Path where the resulting DOCX should be written.
 * @param {object} options     { useOcr: boolean, ocrLocale: string, jobId: string }
 */
async function convertPdfToDocx(inputPath, outputPath, options) {
  const { useOcr, ocrLocale, jobId } = options;
  const pdfServices = getPdfServicesClient();

  try {
    let docxStream;

    if (useOcr) {
      logger.info('Running OCR before export', { jobId });
      const ocrStream = await ocrPdf(pdfServices, inputPath, ocrLocale);
      docxStream = await exportToDocx(pdfServices, ocrStream);
    } else {
      docxStream = await exportToDocx(pdfServices, inputPath);
    }

    await new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPath);
      docxStream.pipe(writeStream);
      docxStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
    });

    return { success: true };
  } catch (err) {
    // Normalize Adobe SDK errors into safe, categorized errors for the job store.
    if (err instanceof ServiceApiError) {
      logger.error('Adobe Service API error', { jobId, errorCode: err.code || 'SERVICE_API_ERROR' });
      throw new Error('ADOBE_SERVICE_ERROR');
    }
    if (err instanceof ServiceUsageError) {
      logger.error('Adobe usage/quota error', { jobId, errorCode: 'SERVICE_USAGE_ERROR' });
      throw new Error('ADOBE_QUOTA_EXCEEDED');
    }
    if (err instanceof SDKError) {
      logger.error('Adobe SDK error', { jobId, errorCode: 'SDK_ERROR' });
      throw new Error('ADOBE_SDK_ERROR');
    }
    logger.error('Unknown conversion error', { jobId, errorCode: 'UNKNOWN_CONVERSION_ERROR' });
    throw new Error('CONVERSION_FAILED');
  }
}

module.exports = { convertPdfToDocx };
