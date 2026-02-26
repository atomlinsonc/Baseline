/**
 * Topic selector — combines Reddit, Google Trends, and YouTube signals
 * into a single ranked list of topic candidates, then uses GPT-4o to
 * select the single best topic for today.
 *
 * Selection criteria (in priority order):
 *  1. Genuine societal/policy debate (not entertainment/sports)
 *  2. Strong divisiveness signal (bimodal public sentiment)
 *  3. Trending across multiple platforms (cross-platform validation)
 *  4. Sufficient available polling/factual data to build a full topic page
 *  5. Not already published (checked against DB)
 */

const OpenAI = require('openai');
const { topicExistsForDate, getRecentRuns } = require('../db/queries');
const { getDb } = require('../db/schema');
const logger = require('../utils/logger');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Cross-reference signals from all three sources and compute a composite score.
 */
function mergeSignals(redditCandidates, googleTrends, youtubeCandidates) {
  const candidates = new Map();

  // Add Reddit topics
  for (const r of redditCandidates) {
    const key = normalizeTitle(r.title);
    candidates.set(key, {
      title: r.title,
      reddit_divisiveness: r.divisiveness_score,
      reddit_comments: r.total_comments,
      reddit_subreddits: r.subreddits,
      google_score: 0,
      youtube_divisiveness: 0,
      sources: ['reddit'],
    });
  }

  // Merge Google Trends
  for (const g of googleTrends) {
    const key = normalizeTitle(g.title);
    let match = findBestMatch(key, candidates);
    if (match) {
      match.google_score = g.score / 100;
      match.sources.push('google_trends');
    } else {
      candidates.set(key, {
        title: g.title,
        reddit_divisiveness: 0,
        reddit_comments: 0,
        reddit_subreddits: [],
        google_score: g.score / 100,
        youtube_divisiveness: 0,
        sources: ['google_trends'],
      });
    }
  }

  // Merge YouTube
  for (const y of youtubeCandidates) {
    const key = normalizeTitle(y.title);
    let match = findBestMatch(key, candidates);
    if (match) {
      match.youtube_divisiveness = y.divisiveness_score;
      match.sources.push('youtube');
    } else {
      candidates.set(key, {
        title: y.title,
        reddit_divisiveness: 0,
        reddit_comments: 0,
        reddit_subreddits: [],
        google_score: 0,
        youtube_divisiveness: y.divisiveness_score,
        sources: ['youtube'],
      });
    }
  }

  // Compute composite divisiveness score
  const scored = Array.from(candidates.values()).map(c => {
    const multiPlatform = Math.min(c.sources.length / 3, 1);
    const divisiveness = (
      c.reddit_divisiveness * 0.45 +
      c.youtube_divisiveness * 0.25 +
      c.google_score * 0.15 +
      multiPlatform * 0.15
    );
    return { ...c, composite_score: divisiveness };
  });

  return scored.sort((a, b) => b.composite_score - a.composite_score).slice(0, 20);
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function findBestMatch(key, map) {
  const keyWords = new Set(key.split(' ').filter(w => w.length > 3));
  let bestMatch = null;
  let bestOverlap = 0;

  for (const [existingKey, val] of map.entries()) {
    const existingWords = new Set(existingKey.split(' ').filter(w => w.length > 3));
    let shared = 0;
    keyWords.forEach(w => { if (existingWords.has(w)) shared++; });
    const overlap = shared / Math.max(keyWords.size, existingWords.size, 1);
    if (overlap > 0.4 && overlap > bestOverlap) {
      bestOverlap = overlap;
      bestMatch = val;
    }
  }
  return bestMatch;
}

/**
 * Get recently published topic titles to avoid repetition.
 */
function getRecentTopicTitles() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT title FROM topics
    WHERE status = 'published'
    ORDER BY date DESC LIMIT 30
  `).all();
  return rows.map(r => r.title);
}

/**
 * Use GPT-4o to select the best topic from candidates and generate
 * the initial structured data.
 */
async function selectTopicWithAI(candidates, date) {
  const recentTitles = getRecentTopicTitles();

  const prompt = `You are the editor of Baseline, a data-driven debate dashboard that surfaces America's most genuinely divisive policy and social debates.

Today's date: ${date}

Below are trending topic candidates ranked by a composite signal score (Reddit divisiveness + YouTube engagement + Google Trends). Your job is to select ONE topic that best meets all criteria:

SELECTION CRITERIA (all must be met):
1. Genuine societal debate — policy, rights, economics, science, civil liberties. NOT sports, entertainment, celebrity drama.
2. Strongly polarized — Americans are genuinely split on this, ideally with clear "pro" and "con" camps.
3. Sufficient empirical ground — there must be real polling data, verifiable claims, and fact-checkable arguments.
4. Timely — the debate is active RIGHT NOW, not something resolved years ago.
5. NOT recently covered — do not repeat these recent topics: ${recentTitles.slice(0, 10).join(', ')}

CANDIDATES:
${candidates.slice(0, 15).map((c, i) =>
  `${i + 1}. "${c.title}"
   Score: ${c.composite_score.toFixed(2)} | Sources: ${c.sources.join(', ')}
   Reddit divisiveness: ${c.reddit_divisiveness.toFixed(2)} | Comments: ${c.reddit_comments}`
).join('\n\n')}

Respond with a JSON object (no markdown, no explanation) in exactly this format:
{
  "selected_title": "Concise, precise topic title suitable for a headline",
  "category": "one of: social-issues|economic-policy|foreign-policy|civil-rights|science-technology|religion|healthcare|immigration|education|environment",
  "summary": "2–3 sentences explaining what the debate is about and why it matters right now. Neutral, factual tone.",
  "trending_reason": "2–3 sentences explaining where this debate is currently happening — which platforms, what events triggered it, what's driving the conversation. Cite the platforms from the signal data.",
  "divisiveness_explanation": "1–2 sentences explaining WHY this topic is genuinely divisive — what values or interests are in conflict.",
  "selection_reasoning": "1–2 sentences explaining why you chose this topic over others."
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);
  logger.info('Topic selected by AI', { title: data.selected_title, reasoning: data.selection_reasoning });
  return data;
}

async function selectTopic(redditCandidates, googleTrends, youtubeCandidates, date) {
  logger.info('Topic selector started', { date });

  // Check if today already has a topic
  if (topicExistsForDate(date)) {
    logger.info('Topic already exists for today, skipping selection');
    return null;
  }

  const candidates = mergeSignals(redditCandidates, googleTrends, youtubeCandidates);
  logger.info(`Merged ${candidates.length} candidate topics`);

  if (candidates.length === 0) {
    throw new Error('No topic candidates found from any source');
  }

  const selected = await selectTopicWithAI(candidates, date);
  return { ...selected, candidates };
}

/**
 * Directly select a topic for a specific date using GPT-4o only,
 * without any scraper signal data. Used when scrapers fail or for
 * backfilling historical dates.
 */
async function selectTopicForDate(date) {
  if (topicExistsForDate(date)) {
    logger.info('Topic already exists for date, skipping selection', { date });
    return null;
  }

  const recentTitles = getRecentTopicTitles();

  const prompt = `You are the editor of Baseline, a data-driven debate dashboard that surfaces America's most genuinely divisive policy and social debates.

Date: ${date}

No real-time trending data is available. Based on your knowledge of what was happening in American politics, law, and society around ${date}, select ONE topic that meets all criteria:

SELECTION CRITERIA (all must be met):
1. Genuine societal debate — policy, rights, economics, science, civil liberties. NOT sports, entertainment, celebrity drama.
2. Strongly polarized — Americans are genuinely split on this, with clear "pro" and "con" camps.
3. Sufficient empirical ground — there must be real polling data, verifiable claims, and fact-checkable arguments.
4. Timely for ${date} — the debate was active and prominent around this specific date.
5. NOT recently covered — do not repeat these recent topics: ${recentTitles.slice(0, 15).join(', ')}

Think about what was dominating political discussion, congressional debates, court rulings, executive orders, or major social movements around ${date}. Choose the single most divisive, substantive, data-rich debate of that moment.

Respond with a JSON object (no markdown, no explanation) in exactly this format:
{
  "selected_title": "Concise, precise topic title suitable for a headline",
  "category": "one of: social-issues|economic-policy|foreign-policy|civil-rights|science-technology|religion|healthcare|immigration|education|environment",
  "summary": "2–3 sentences explaining what the debate is about and why it matters. Neutral, factual tone.",
  "trending_reason": "2–3 sentences describing what was driving this debate around ${date} — key events, court cases, legislation, or news stories that made it prominent.",
  "divisiveness_explanation": "1–2 sentences explaining WHY this topic is genuinely divisive — what values or interests are in conflict.",
  "selection_reasoning": "1–2 sentences explaining why you chose this topic for ${date} specifically."
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);
  logger.info('Topic directly selected by AI', { date, title: data.selected_title, reasoning: data.selection_reasoning });
  return { ...data, candidates: [] };
}

module.exports = { selectTopic, selectTopicForDate };
