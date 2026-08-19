/**
 * routes/health.routes.js
 * GET /api/health - used by the WordPress admin "Test Backend Connection"
 * button and by hosting-provider health checks. Deliberately requires no
 * auth so uptime monitors can hit it, and returns no sensitive information.
 */

'use strict';

const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
