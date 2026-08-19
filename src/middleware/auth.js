/**
 * middleware/auth.js
 *
 * Verifies that incoming requests genuinely come from the trusted WordPress
 * plugin, using a shared secret sent in the "x-plugin-secret" header.
 * Uses crypto.timingSafeEqual to avoid leaking secret length/content via
 * response-time side channels.
 */

'use strict';

const crypto = require('crypto');
const { config } = require('../config/env');

function timingSafeEqualStrings(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Compare against a same-length dummy so this still takes constant time.
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireSharedSecret(req, res, next) {
  const providedSecret = req.get('x-plugin-secret');

  if (!providedSecret || !timingSafeEqualStrings(providedSecret, config.pluginSharedSecret)) {
    return res.status(401).json({
      success: false,
      errorCode: 'UNAUTHORIZED',
      message: 'Request could not be authenticated.'
    });
  }

  next();
}

module.exports = { requireSharedSecret };
