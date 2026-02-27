/**
 * Topic selector — combines Reddit, Google Trends, and YouTube signals
 * into a single ranked list of topic candidates, then uses GPT-4o to
 * select the single best topic for today.
 *
 * Selection criteria (in priority order):
 *  1. Broad mainstream public interest — widely discussed, not niche
 *  2. Genuinely contested — Americans disagree, ideally ~40–60% split
 *  3. Has real polling data from major pollsters (Gallup, Pew, AP-NORC, etc.)
 *  4. Trending / timely — active debate RIGHT NOW
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

  // Compute composite score — popularity/engagement first, divisiveness as filter
  const scored = Array.from(candidates.values()).map(c => {
    const multiPlatform = Math.min(c.sources.length / 3, 1);
    // Normalize comment volume as a popularity signal (5k comments = fully engaged)
    const engagementScore = Math.min(c.reddit_comments / 5000, 1);
    const composite = (
      engagementScore * 0.35 +          // raw engagement = how many people care
      c.google_score * 0.25 +           // google trending = mainstream interest
      multiPlatform * 0.20 +            // cross-platform presence = not niche
      c.reddit_divisiveness * 0.20      // some polarization required, not dominant
    );
    return { ...c, composite_score: composite };
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

  const prompt = `You are the editor of Baseline, a data-driven debate dashboard that covers America's most widely-discussed contested policy debates.

Today's date: ${date}

Below are trending topic candidates ranked by a composite signal score (engagement volume + Google Trends + cross-platform presence + some divisiveness). Your job is to select ONE topic that best meets all criteria:

SELECTION CRITERIA (ranked by importance):
1. POPULAR & MAINSTREAM — millions of Americans are actively talking about this. It should be a topic that appears on network news, is dinner-table conversation, and that a typical American has a clear opinion on. NOT niche, academic, or specialized.
2. GENUINELY CONTESTED — Americans are split on this (not 90/10, closer to 40/60 or 50/50). Clear pro and con camps exist. Mainstream people disagree, not just political extremes.
3. HAS REAL POLLING DATA — this MUST be a topic where major pollsters (Gallup, Pew Research, AP-NORC, CNN, NYT/Siena, ABC/WaPo, Quinnipiac) have asked Americans their opinion. If you cannot name at least one real poll on this topic, do NOT select it.
4. TIMELY — the debate is active right now, not dormant.
5. NOT RECENTLY COVERED — do not repeat: ${recentTitles.slice(0, 10).join(', ')}

IMPORTANT: Prefer big, familiar topics (immigration enforcement, abortion access, gun control, healthcare costs, minimum wage, Social Security, climate policy, drug pricing, criminal justice) over niche regulatory debates. A topic being "extremely divisive" is less important than it being widely known and having solid polling.

CANDIDATES:
${candidates.slice(0, 15).map((c, i) =>
  `${i + 1}. "${c.title}"
   Score: ${c.composite_score.toFixed(2)} | Sources: ${c.sources.join(', ')}
   Engagement (comments): ${c.reddit_comments} | Google trending: ${c.google_score.toFixed(2)}`
).join('\n\n')}

Respond with a JSON object (no markdown, no explanation) in exactly this format:
{
  "selected_title": "Concise, precise topic title suitable for a headline (e.g. 'Debate Over Stricter Immigration Enforcement')",
  "category": "one of: social-issues|economic-policy|foreign-policy|civil-rights|science-technology|religion|healthcare|immigration|education|environment",
  "summary": "2–3 sentences explaining what the debate is about and why it matters right now. Neutral, factual tone.",
  "trending_reason": "2–3 sentences explaining where this debate is currently happening — which platforms, what events triggered it, what's driving the conversation.",
  "divisiveness_explanation": "1–2 sentences explaining WHY this topic is genuinely contested — what values or interests are in conflict.",
  "selection_reasoning": "1–2 sentences explaining why you chose this topic. Confirm it has real polling data.",
  "polling_hint": "The specific polling question or search terms most likely to find real survey data for this topic (e.g. 'immigration deportation Gallup' or 'minimum wage increase support poll'). Be specific."
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

  const prompt = `You are the editor of Baseline, a data-driven debate dashboard that covers America's most widely-discussed contested policy debates.

Date: ${date}

No real-time trending data is available. Based on your knowledge of what was happening in American politics, law, and society around ${date}, select ONE topic that meets all criteria:

SELECTION CRITERIA (ranked by importance):
1. POPULAR & MAINSTREAM — this should be a topic that millions of ordinary Americans were actively discussing around ${date}. It should appear on network TV news, be a dinner-table topic, and something a typical American has a strong opinion on. NOT a niche regulatory or academic debate.
2. GENUINELY CONTESTED — Americans were split on this (closer to 40/60 or 50/50, not 90/10). Clear mainstream pro and con camps exist.
3. HAS REAL POLLING DATA — you MUST be able to name at least one real poll from Gallup, Pew Research, AP-NORC, CNN, NYT/Siena, ABC/WaPo, Quinnipiac, or similar that asked Americans about this topic. If no such poll exists, do NOT choose this topic.
4. TIMELY for ${date} — the debate was active and prominent around this specific date.
5. NOT recently covered — do not repeat: ${recentTitles.slice(0, 15).join(', ')}

Think about what was dominating political discussion, congressional debates, court rulings, or major news around ${date}. Strongly prefer big, familiar American debates: immigration, abortion, gun control, healthcare, minimum wage, Social Security, climate, criminal justice, taxes, education. Avoid niche, technical, or regulatory topics that most Americans couldn't name.

Respond with a JSON object (no markdown, no explanation) in exactly this format:
{
  "selected_title": "Concise, precise topic title suitable for a headline",
  "category": "one of: social-issues|economic-policy|foreign-policy|civil-rights|science-technology|religion|healthcare|immigration|education|environment",
  "summary": "2–3 sentences explaining what the debate is about and why it matters. Neutral, factual tone.",
  "trending_reason": "2–3 sentences describing what was driving this debate around ${date} — key events, court cases, legislation, or news stories that made it prominent.",
  "divisiveness_explanation": "1–2 sentences explaining WHY this topic is genuinely contested — what values or interests are in conflict.",
  "selection_reasoning": "1–2 sentences explaining why you chose this topic. Confirm it has real polling data.",
  "polling_hint": "The specific polling question or search terms most likely to find real survey data for this topic (e.g. 'immigration deportation Gallup' or 'abortion ban support Pew'). Be specific."
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const data = JSON.parse(response.choices[0].message.content);

  // Guard: reject placeholder/fallback titles that indicate AI couldn't find a topic
  const badTitlePatterns = [/no suitable/i, /not available/i, /no topic/i, /unable to/i, /cannot find/i];
  if (!data.selected_title || badTitlePatterns.some(p => p.test(data.selected_title))) {
    throw new Error(`GPT-4o could not find a suitable topic for ${date}: "${data.selected_title}"`);
  }

  logger.info('Topic directly selected by AI', { date, title: data.selected_title, reasoning: data.selection_reasoning });
  return { ...data, candidates: [] };
}

module.exports = { selectTopic, selectTopicForDate };
