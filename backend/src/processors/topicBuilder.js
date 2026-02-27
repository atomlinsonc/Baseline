/**
 * Topic builder — the main orchestrator.
 * Calls all processors and writes the complete topic to the database.
 */

const { slugify } = require('../utils/slugify');
const {
  insertTopic,
  insertPoll,
  insertArgument,
  insertClaim,
  insertTrendSignal,
} = require('../db/queries');
const { scrapePollingData } = require('../scrapers/pollingScraper');
const { processPollingData } = require('./pollingProcessor');
const { buildClaimTree } = require('./claimTreeBuilder');
const logger = require('../utils/logger');

async function buildTopic(selectedTopic, signalData, date) {
  logger.info('Topic builder started', { title: selectedTopic.selected_title, date });

  const slug = slugify(selectedTopic.selected_title, date);

  // ── 1. Insert the base topic record ─────────────────────────────────────────
  const topicId = insertTopic({
    slug,
    title: selectedTopic.selected_title,
    date,
    category: selectedTopic.category,
    summary: selectedTopic.summary,
    trending_reason: selectedTopic.trending_reason,
    divisiveness_score: signalData.topCandidate?.composite_score ?? 0.5,
    status: 'published',
  });

  logger.info('Topic record created', { topicId, slug });

  // ── 2. Save trend signals ────────────────────────────────────────────────────
  if (signalData.reddit) {
    const top = signalData.reddit[0];
    if (top) {
      insertTrendSignal({
        topic_id: topicId,
        source: 'reddit',
        signal_type: 'divisiveness',
        value: top.divisiveness_score,
        metadata: JSON.stringify({ subreddits: top.subreddits, comments: top.total_comments }),
      });
    }
  }
  if (signalData.google) {
    const top = signalData.google[0];
    if (top) {
      insertTrendSignal({
        topic_id: topicId,
        source: 'google_trends',
        signal_type: 'trending_score',
        value: top.score / 100,
        metadata: JSON.stringify({ title: top.title }),
      });
    }
  }

  // ── 3. Scrape and process polling data ───────────────────────────────────────
  logger.info('Fetching polling data...');
  const rawPolls = await scrapePollingData(selectedTopic.selected_title);
  const processedPolls = await processPollingData(
    selectedTopic.selected_title,
    rawPolls,
    selectedTopic.polling_hint || ''
  );

  for (const poll of processedPolls) {
    insertPoll({
      topic_id: topicId,
      pollster: poll.pollster || 'Unknown',
      question: poll.question || selectedTopic.selected_title,
      date_range: poll.date_range || '',
      source_url: poll.source_url || null,
      topline_support: poll.topline_support ?? null,
      topline_oppose: poll.topline_oppose ?? null,
      topline_neutral: poll.topline_neutral ?? null,
      demographics: poll.demographics ? JSON.stringify(poll.demographics) : null,
      raw_text: poll.raw_text || null,
    });
  }
  logger.info(`Saved ${processedPolls.length} polls`);

  // ── 4. Build argument/claim tree ─────────────────────────────────────────────
  logger.info('Building claim tree...');
  const claimTree = await buildClaimTree(
    selectedTopic.selected_title,
    selectedTopic.summary,
    selectedTopic.trending_reason
  );

  // Insert pro arguments
  for (let i = 0; i < (claimTree.pro || []).length; i++) {
    const arg = claimTree.pro[i];
    const argId = insertArgument({
      topic_id: topicId,
      side: 'pro',
      position: i,
      headline: arg.headline,
      summary: arg.summary,
    });
    for (let j = 0; j < (arg.claims || []).length; j++) {
      const claim = arg.claims[j];
      insertClaim({
        argument_id: argId,
        topic_id: topicId,
        position: j,
        statement: claim.statement,
        verdict: claim.verdict,
        verdict_explanation: claim.verdict_explanation,
        is_values_based: claim.values_based ? 1 : 0,
        sources: JSON.stringify(claim.sources || []),
      });
    }
  }

  // Insert con arguments
  for (let i = 0; i < (claimTree.con || []).length; i++) {
    const arg = claimTree.con[i];
    const argId = insertArgument({
      topic_id: topicId,
      side: 'con',
      position: i,
      headline: arg.headline,
      summary: arg.summary,
    });
    for (let j = 0; j < (arg.claims || []).length; j++) {
      const claim = arg.claims[j];
      insertClaim({
        argument_id: argId,
        topic_id: topicId,
        position: j,
        statement: claim.statement,
        verdict: claim.verdict,
        verdict_explanation: claim.verdict_explanation,
        is_values_based: claim.values_based ? 1 : 0,
        sources: JSON.stringify(claim.sources || []),
      });
    }
  }

  logger.info('Claim tree saved', {
    pro: claimTree.pro?.length,
    con: claimTree.con?.length,
  });

  return { topicId, slug };
}

module.exports = { buildTopic };
