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

// POST /api/admin/seed-sample — insert a sample topic for today (bypasses scrapers)
router.post('/seed-sample', requireAdmin, (req, res) => {
  try {
    const { initDb } = require('../db/schema');
    const { insertTopic, insertPoll, insertArgument, insertClaim, topicExistsForDate } = require('../db/queries');

    initDb();
    const TODAY = new Date().toISOString().slice(0, 10);

    if (topicExistsForDate(TODAY)) {
      return res.json({ message: `Topic already exists for ${TODAY}`, date: TODAY });
    }

    const topicId = insertTopic({
      slug: `student-loan-forgiveness-${TODAY}`,
      title: 'Student Loan Forgiveness',
      date: TODAY,
      category: 'economic-policy',
      summary: 'The debate over federal student debt cancellation continues as courts, Congress, and the executive branch clash over the scope and legality of broad relief programs. Over $1.7 trillion in outstanding student debt shapes economic mobility for millions of Americans.',
      trending_reason: 'Student debt relief is actively debated across Reddit\'s r/politics and r/PoliticalDiscussion, trending on Google, and drawing millions of YouTube views as ongoing court rulings and new administration policies keep the issue in the news cycle.',
      divisiveness_score: 0.78,
      status: 'published',
    });

    insertPoll({ topic_id: topicId, pollster: 'AP-NORC', question: 'Do you favor or oppose the federal government forgiving student loan debt?', date_range: 'Sep 2023', source_url: 'https://apnorc.org', topline_support: 42, topline_oppose: 58, topline_neutral: null, demographics: JSON.stringify({ party: { Democrat: { support: 70, oppose: 30 }, Republican: { support: 14, oppose: 86 }, Independent: { support: 40, oppose: 60 } }, age: { '18-29': { support: 60, oppose: 40 }, '30-44': { support: 48, oppose: 52 }, '45-64': { support: 36, oppose: 64 }, '65+': { support: 28, oppose: 72 } } }), raw_text: 'AP-NORC Poll Sep 2023' });
    insertPoll({ topic_id: topicId, pollster: 'Pew Research Center', question: 'Support for canceling student loan debt for those who didn\'t complete their degree', date_range: 'Feb 2023', source_url: 'https://pewresearch.org', topline_support: 56, topline_oppose: 44, topline_neutral: null, demographics: JSON.stringify({ party: { Democrat: { support: 79, oppose: 21 }, Republican: { support: 31, oppose: 69 } } }), raw_text: 'Pew Research Feb 2023' });

    const pro1 = insertArgument({ topic_id: topicId, side: 'pro', position: 0, headline: 'Student debt is a macroeconomic drag', summary: 'Over $1.7 trillion in outstanding student debt suppresses consumer spending, homeownership, and retirement savings, constraining economic growth.' });
    insertClaim({ argument_id: pro1, topic_id: topicId, position: 0, statement: 'Total U.S. student loan debt exceeds $1.7 trillion as of 2024.', verdict: 'supported', verdict_explanation: 'Federal Reserve and Department of Education data confirm this. The total has exceeded $1.7T since 2021.', is_values_based: 0, sources: JSON.stringify([{ name: 'Federal Reserve', url: 'https://www.federalreserve.gov', verdict_from_source: 'Confirmed in Consumer Credit report' }]) });
    insertClaim({ argument_id: pro1, topic_id: topicId, position: 1, statement: 'Student debt holders are significantly less likely to own homes than similar cohorts without debt.', verdict: 'mostly_supported', verdict_explanation: 'Multiple studies find correlation between student debt and delayed homeownership. Causality debate exists.', is_values_based: 0, sources: JSON.stringify([{ name: 'Federal Reserve Bank of NY', url: 'https://www.newyorkfed.org', verdict_from_source: 'Found significant negative effect on homeownership' }]) });

    const pro2 = insertArgument({ topic_id: topicId, side: 'pro', position: 1, headline: 'Predatory for-profit colleges caused systemic harm', summary: 'Millions of borrowers attended schools that fraudulently misrepresented job placement rates, leaving students with debt and worthless credentials.' });
    insertClaim({ argument_id: pro2, topic_id: topicId, position: 0, statement: 'The Department of Education found that many for-profit colleges engaged in deceptive marketing practices.', verdict: 'supported', verdict_explanation: 'DOE investigations and AG lawsuits against ITT Tech, Corinthian Colleges, and DeVry documented systematic misrepresentation.', is_values_based: 0, sources: JSON.stringify([{ name: 'Department of Education', url: 'https://studentaid.gov/borrower-defense', verdict_from_source: 'Approved $11.7B in borrower defense claims' }]) });

    const pro3 = insertArgument({ topic_id: topicId, side: 'pro', position: 2, headline: 'Government should honor its implicit social contract', summary: 'Students were encouraged by schools and government policy to take on debt as an investment — cancellation corrects for a promise that didn\'t pay off.' });
    insertClaim({ argument_id: pro3, topic_id: topicId, position: 0, statement: 'Canceling student debt is fair given that high-income earners received more benefit from past tax cuts.', verdict: 'unverifiable', verdict_explanation: 'This is a values-based distributional fairness claim that cannot be empirically resolved.', is_values_based: 1, sources: JSON.stringify([]) });

    const con1 = insertArgument({ topic_id: topicId, side: 'con', position: 0, headline: 'Cancellation is regressive — it benefits higher earners', summary: 'College graduates earn more than non-graduates over a lifetime. Broad cancellation transfers wealth upward, from non-college-goers to those who attended.' });
    insertClaim({ argument_id: con1, topic_id: topicId, position: 0, statement: 'College graduates earn significantly more over their lifetimes, making debt cancellation a transfer to higher earners.', verdict: 'mostly_supported', verdict_explanation: 'BLS data shows bachelor\'s degree holders earn a median 65% more than high school graduates. Effect is less clear for graduate debt and for-profit school dropouts.', is_values_based: 0, sources: JSON.stringify([{ name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov', verdict_from_source: 'Education pays report confirms wage premium' }, { name: 'Brookings Institution', url: 'https://brookings.edu', verdict_from_source: 'Confirmed regressive distribution of broad cancellation' }]) });
    insertClaim({ argument_id: con1, topic_id: topicId, position: 1, statement: 'The majority of outstanding student loan debt is held by graduate students and professionals.', verdict: 'mostly_supported', verdict_explanation: 'Graduate borrowers hold ~53% of total debt despite being ~40% of borrowers. "Majority" is technically accurate but understates undergrad debt.', is_values_based: 0, sources: JSON.stringify([{ name: 'Education Data Initiative', url: 'https://educationdata.org', verdict_from_source: 'Graduate borrower data confirmed' }]) });

    const con2 = insertArgument({ topic_id: topicId, side: 'con', position: 1, headline: 'Adds to national debt without fixing root cause', summary: 'Cancellation addresses symptoms but not rising tuition costs, and may worsen the problem by signaling future cancellations.' });
    insertClaim({ argument_id: con2, topic_id: topicId, position: 0, statement: 'The Biden administration\'s broad student debt cancellation plan would have cost approximately $400 billion.', verdict: 'supported', verdict_explanation: 'The CBO estimated the cost of the plan struck down in Biden v. Nebraska at ~$400 billion.', is_values_based: 0, sources: JSON.stringify([{ name: 'Congressional Budget Office', url: 'https://cbo.gov', verdict_from_source: 'CBO cost estimate confirmed ~$400B' }]) });

    const con3 = insertArgument({ topic_id: topicId, side: 'con', position: 2, headline: 'Unfair to those who repaid or avoided debt', summary: 'People who worked through school, chose community college, or scrimped to repay loans receive nothing — rewarding those who borrowed more.' });
    insertClaim({ argument_id: con3, topic_id: topicId, position: 0, statement: 'Forgiving student loans is fundamentally unfair to borrowers who already paid off their loans.', verdict: 'unverifiable', verdict_explanation: 'Fairness claims about who "deserves" relief are fundamentally normative and cannot be resolved empirically.', is_values_based: 1, sources: JSON.stringify([]) });

    logger.info('Sample topic seeded via admin API', { topicId, date: TODAY });
    res.json({ message: 'Sample topic seeded', topicId, date: TODAY, slug: `student-loan-forgiveness-${TODAY}` });
  } catch (err) {
    logger.error('Admin seed-sample failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/backfill — generate topics for a date range (uses GPT-4o for each day)
router.post('/backfill', requireAdmin, async (req, res) => {
  const { start_date, end_date } = req.body || {};

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date required (YYYY-MM-DD)' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format' });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start) || isNaN(end) || start > end) {
    return res.status(400).json({ error: 'Invalid date range' });
  }

  // Count days to process
  const days = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
  logger.info('Backfill started via admin API', { start_date, end_date, days });

  // Respond immediately so the request doesn't time out
  res.json({ message: 'Backfill started', start_date, end_date, days });

  // Run async in background
  (async () => {
    const { runDailyPipeline } = require('../scheduler/runDaily');
    const { topicExistsForDate } = require('../db/queries');

    let succeeded = 0;
    let skipped = 0;
    let failed = 0;
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);

      if (topicExistsForDate(dateStr)) {
        logger.info(`Backfill: skipping ${dateStr} (already exists)`);
        skipped++;
      } else {
        try {
          await runDailyPipeline(dateStr);
          succeeded++;
          logger.info(`Backfill: completed ${dateStr}`, { succeeded, failed, remaining: days - succeeded - skipped - failed });
        } catch (err) {
          failed++;
          logger.error(`Backfill: failed ${dateStr}`, { error: err.message });
        }
        // Pause between days to avoid OpenAI rate limits
        await new Promise(r => setTimeout(r, 3000));
      }

      current.setDate(current.getDate() + 1);
    }

    logger.info('Backfill complete', { succeeded, skipped, failed, total: days });
  })().catch(err => logger.error('Backfill fatal error', { error: err.message }));
});

// DELETE /api/admin/topics/:slug — remove a bad/test topic from the DB
router.delete('/topics/:slug', requireAdmin, (req, res) => {
  try {
    const { getDb } = require('../db/schema');
    const db = getDb();
    const { slug } = req.params;

    const topic = db.prepare(`SELECT id FROM topics WHERE slug = ?`).get(slug);
    if (!topic) {
      return res.status(404).json({ error: `Topic not found: ${slug}` });
    }

    // Cascade delete all related data
    db.prepare(`DELETE FROM claims WHERE topic_id = ?`).run(topic.id);
    db.prepare(`DELETE FROM arguments WHERE topic_id = ?`).run(topic.id);
    db.prepare(`DELETE FROM polls WHERE topic_id = ?`).run(topic.id);
    db.prepare(`DELETE FROM trend_signals WHERE topic_id = ?`).run(topic.id);
    db.prepare(`DELETE FROM topics WHERE id = ?`).run(topic.id);

    logger.info('Topic deleted via admin API', { slug, topicId: topic.id });
    res.json({ message: `Deleted topic: ${slug}` });
  } catch (err) {
    logger.error('Admin delete topic failed', { error: err.message });
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
