/**
 * utils/sanitizeFilename.js
 *
 * Turns an original uploaded PDF filename into a safe output DOCX filename.
 * Strips path separators, control characters, and anything that isn't a
 * conservative safe character set, so the value can never be used for path
 * traversal or to inject headers into the download response.
 */

'use strict';

const path = require('path');

function sanitizeFilename(originalName) {
  const base = path.basename(String(originalName || 'document'));
  const withoutExt = base.replace(/\.pdf$/i, '');

  const safe = withoutExt
    .normalize('NFKD')
    .replace(/[^\w\-. ]/g, '') // keep letters, numbers, underscore, dash, dot, space
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .slice(0, 100);

  return `${safe || 'converted-document'}.docx`;
}

module.exports = { sanitizeFilename };
