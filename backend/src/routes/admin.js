/**
 * Admin routes — protected by ADMIN_SECRET env var.
 * These are for manually triggering the daily pipeline and checking run status.
 * Not exposed to the public.
 */

const express = require('express');
const router = express.Router();
const { getRecentRuns } = require('../db/queries');
const logger = require('../utils/logger');

// Simple middleware: check Authorization header
function requireAdmin(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'Admin not configured (set ADMIN_SECRET)' });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    logger.warn('Unauthorized admin access attempt', { ip: req.ip });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// POST /api/admin/run-daily — trigger the daily pipeline
router.post('/run-daily', requireAdmin, async (req, res) => {
  try {
    // Import lazily to avoid circular deps
    const { runDailyPipeline } = require('../scheduler/runDaily');
    logger.info('Manual pipeline trigger via admin API');

    // Run async — respond immediately, log result when done
    res.json({ message: 'Pipeline started', timestamp: new Date().toISOString() });

    runDailyPipeline()
      .then(result => logger.info('Manual pipeline complete', result))
      .catch(err => logger.error('Manual pipeline error', { error: err.message }));
  } catch (err) {
    logger.error('Admin run-daily failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/run-log — recent pipeline run history
router.get('/run-log', requireAdmin, (req, res) => {
  try {
    const runs = getRecentRuns(20);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/health — detailed health check
router.get('/health', requireAdmin, (req, res) => {
  const { getDb } = require('../db/schema');
  const db = getDb();
  const topicCount = db.prepare('SELECT COUNT(*) as n FROM topics WHERE status = ?').get('published').n;
  const lastRun = db.prepare('SELECT * FROM run_log ORDER BY created_at DESC LIMIT 1').get();

  res.json({
    status: 'ok',
    published_topics: topicCount,
    last_run: lastRun,
    uptime_seconds: Math.floor(process.uptime()),
    env: {
      has_openai: !!process.env.OPENAI_API_KEY,
      has_reddit: !!(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET),
      has_serpapi: !!process.env.SERPAPI_KEY,
      has_youtube: !!process.env.YOUTUBE_API_KEY,
    },
  });
});

module.exports = router;
