/**
 * middleware/cors.js
 *
 * Restricts cross-origin requests to only the WordPress domain(s) configured
 * in ALLOWED_ORIGINS. Requests with no Origin header (e.g. server-to-server
 * health checks) are allowed through since they aren't browser CORS
 * requests; browser requests from any other origin are rejected.
 */

'use strict';

const cors = require('cors');
const { config } = require('../config/env');

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (config.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-plugin-secret'],
  maxAge: 600
};

module.exports = cors(corsOptions);
