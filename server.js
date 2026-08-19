/**
 * server.js
 * Entry point for the PDF to Word backend service.
 */

'use strict';

const fs = require('fs');
const express = require('express');
const helmet = require('helmet');

const { config, validateStartup } = require('./config/env');
validateStartup();

if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}

const corsMiddleware = require('./middleware/cors');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { startCleanupScheduler } = require('./services/cleanupService');
const logger = require('./utils/logger');

const healthRoutes = require('./routes/health.routes');
const convertRoutes = require('./routes/convert.routes');
const statusRoutes = require('./routes/status.routes');
const downloadRoutes = require('./routes/download.routes');
const jobRoutes = require('./routes/job.routes');

const app = express();

// Do not trust-proxy by default; enable only if actually behind a
// reverse proxy (Railway/Render terminate TLS in front of the app), so
// req.ip reflects the real client for rate limiting.
app.set('trust proxy', 1);

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '1mb' }));
app.use('/api', generalLimiter);

app.use('/api', healthRoutes);
app.use('/api', convertRoutes);
app.use('/api', statusRoutes);
app.use('/api', downloadRoutes);
app.use('/api', jobRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info('Server started', { status: `listening_on_${config.port}` });
  startCleanupScheduler();
});
