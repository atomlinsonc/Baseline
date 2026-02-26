/**
 * Daily pipeline runner.
 *
 * Can be triggered:
 *  1. By node-cron (scheduled, inside the server process)
 *  2. Directly: `node src/scheduler/runDaily.js`
 *  3. Via API: POST /api/admin/run-daily (protected by ADMIN_SECRET)
 *
 * Pipeline:
 *  scrapeReddit → scrapeGoogleTrends → scrapeYoutube
 *  → selectTopic → buildTopic → logRun
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
require('openai/shims/node'); // Ensure Node.js-native fetch/File shims for openai SDK

const { scrapeReddit } = require('../scrapers/redditScraper');
const { scrapeGoogleTrends } = require('../scrapers/googleTrendsScraper');
const { scrapeYoutube } = require('../scrapers/youtubeScraper');
const { selectTopic, selectTopicForDate } = require('../processors/topicSelector');
const { buildTopic } = require('../processors/topicBuilder');
const { logRun, topicExistsForDate } = require('../db/queries');
const { initDb } = require('../db/schema');
const logger = require('../utils/logger');

async function runDailyPipeline(overrideDate = null) {
  const date = overrideDate || new Date().toISOString().slice(0, 10);
  const startTime = Date.now();
  let topicId = null;

  logger.info('=== Daily pipeline starting ===', { date });

  // Ensure DB is initialized
  initDb();

  // Guard: skip if already ran for this date
  if (topicExistsForDate(date)) {
    logger.info('Topic already published for date — skipping run', { date });
    logRun({ run_date: date, status: 'skipped', topic_id: null, error_msg: 'Topic already exists', duration_ms: 0 });
    return { status: 'skipped', date };
  }

  try {
    // ── Phase 1: Scraping (run all in parallel) ──────────────────────────────
    logger.info('Phase 1: Scraping signals...');
    const [redditResults, googleResults, youtubeResults] = await Promise.allSettled([
      scrapeReddit(),
      scrapeGoogleTrends(),
      scrapeYoutube(),
    ]);

    const reddit  = redditResults.status  === 'fulfilled' ? redditResults.value  : [];
    const google  = googleResults.status  === 'fulfilled' ? googleResults.value  : [];
    const youtube = youtubeResults.status === 'fulfilled' ? youtubeResults.value : [];

    logger.info('Scraping complete', {
      reddit: reddit.length,
      google: google.length,
      youtube: youtube.length,
    });

    // ── Phase 2: Topic selection ─────────────────────────────────────────────
    logger.info('Phase 2: Selecting topic...');
    let selectedTopic;

    if (reddit.length === 0 && google.length === 0 && youtube.length === 0) {
      // Scrapers returned nothing — fall back to direct GPT-4o selection
      logger.warn('All scrapers returned empty results — falling back to direct GPT-4o topic selection');
      selectedTopic = await selectTopicForDate(date);
    } else {
      selectedTopic = await selectTopic(reddit, google, youtube, date);
    }

    if (!selectedTopic) {
      logRun({ run_date: date, status: 'skipped', topic_id: null, error_msg: 'Topic already exists', duration_ms: Date.now() - startTime });
      return { status: 'skipped', date };
    }

    // ── Phase 3: Build full topic page ───────────────────────────────────────
    logger.info('Phase 3: Building topic page...', { title: selectedTopic.selected_title });
    const topCandidate = (selectedTopic.candidates || [])[0];
    const { topicId: id, slug } = await buildTopic(
      selectedTopic,
      { reddit, google, youtube, topCandidate },
      date
    );
    topicId = id;

    const duration = Date.now() - startTime;
    logger.info('=== Daily pipeline complete ===', { date, slug, duration_ms: duration });

    logRun({ run_date: date, status: 'success', topic_id: topicId, error_msg: null, duration_ms: duration });
    return { status: 'success', date, slug, topicId };

  } catch (err) {
    const duration = Date.now() - startTime;
    logger.error('Daily pipeline failed', { error: err.message, stack: err.stack });
    logRun({ run_date: date, status: 'error', topic_id: null, error_msg: err.message, duration_ms: duration });
    throw err;
  }
}

// ── Run directly ──────────────────────────────────────────────────────────────
if (require.main === module) {
  runDailyPipeline()
    .then(result => {
      logger.info('Run complete', result);
      process.exit(0);
    })
    .catch(err => {
      logger.error('Run failed', { error: err.message });
      process.exit(1);
    });
}

module.exports = { runDailyPipeline };
