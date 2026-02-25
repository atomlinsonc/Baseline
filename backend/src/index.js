/**
 * Baseline — Backend API server
 *
 * Starts Express, initializes the DB, registers routes,
 * and schedules the daily pipeline via node-cron.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');

const { initDb } = require('./db/schema');
const topicsRouter = require('./routes/topics');
const adminRouter = require('./routes/admin');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Initialize DB ─────────────────────────────────────────────────────────────
initDb();

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Render health checks)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Rate limiting — public API
app.use('/api/topics', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use('/api/topics', topicsRouter);
app.use('/api/admin',  adminRouter);

// 404
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Daily cron: 6:00 AM Eastern (11:00 UTC) ──────────────────────────────────
cron.schedule('0 11 * * *', async () => {
  logger.info('Cron: daily pipeline triggered');
  try {
    const { runDailyPipeline } = require('./scheduler/runDaily');
    await runDailyPipeline();
  } catch (err) {
    logger.error('Cron: daily pipeline failed', { error: err.message });
  }
}, { timezone: 'UTC' });

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`Baseline API running on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    cors_origins: allowedOrigins,
  });
});

module.exports = app;
