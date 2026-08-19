/**
 * middleware/rateLimiter.js
 *
 * Two rate limiters:
 * - convertLimiter: strict limit on the expensive /api/convert endpoint
 *   (per IP), to control Adobe API usage and prevent abuse.
 * - generalLimiter: a looser limit applied to all other API routes.
 *
 * Note: the WordPress plugin's own "daily conversion limit per IP" setting
 * is enforced separately, in WordPress. This limiter is a backend-side
 * safety net that applies regardless of what the plugin does.
 */

'use strict';

const rateLimit = require('express-rate-limit');

const convertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 conversion requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many conversion requests. Please try again later.'
  }
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please try again later.'
  }
});

module.exports = { convertLimiter, generalLimiter };
