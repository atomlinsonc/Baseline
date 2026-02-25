/**
 * Reddit scraper — identifies trending & divisive topics.
 *
 * Strategy:
 *  1. Pull hot/top posts from news, politics, worldnews, and opinion subreddits.
 *  2. Score each topic for divisiveness via comment sentiment bimodality:
 *     - High upvote_ratio AND high comment volume → engaging but not divisive.
 *     - Low upvote_ratio (0.45–0.65) + high comments → genuinely divisive.
 *  3. Cluster similar posts by keyword overlap and return top candidates.
 *
 * Falls back to RSS parsing if the Reddit API credentials are missing.
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

const SUBREDDITS = [
  'politics', 'news', 'worldnews', 'AmericanPolitics',
  'Conservative', 'liberal', 'PoliticalDiscussion',
  'changemyview', 'neutralnews', 'Ask_Politics',
];

const RSS_BASE = 'https://www.reddit.com/r';
const rssParser = new RSSParser();

// ── OAuth token management ────────────────────────────────────────────────────
let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT } = process.env;
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) return null;

  try {
    const resp = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      'grant_type=client_credentials',
      {
        auth: { username: REDDIT_CLIENT_ID, password: REDDIT_CLIENT_SECRET },
        headers: {
          'User-Agent': REDDIT_USER_AGENT || 'Baseline/1.0',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    _token = resp.data.access_token;
    _tokenExpiry = Date.now() + (resp.data.expires_in - 60) * 1000;
    return _token;
  } catch (err) {
    logger.warn('Reddit OAuth failed — falling back to RSS', { error: err.message });
    return null;
  }
}

// ── API fetch ─────────────────────────────────────────────────────────────────
async function fetchSubredditApi(subreddit, sort = 'hot', limit = 25) {
  const token = await getToken();
  if (!token) return null;

  try {
    const resp = await axios.get(
      `https://oauth.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': process.env.REDDIT_USER_AGENT || 'Baseline/1.0',
        },
        timeout: 10000,
      }
    );
    return resp.data.data.children.map(c => c.data);
  } catch (err) {
    logger.warn(`Reddit API error for r/${subreddit}`, { error: err.message });
    return null;
  }
}

// ── RSS fallback ──────────────────────────────────────────────────────────────
async function fetchSubredditRss(subreddit) {
  try {
    const feed = await rssParser.parseURL(`${RSS_BASE}/${subreddit}/hot.rss`);
    return feed.items.map(item => ({
      title: item.title,
      selftext: item.contentSnippet || '',
      url: item.link,
      score: 0,
      num_comments: 0,
      upvote_ratio: 0.5,
      subreddit,
    }));
  } catch (err) {
    logger.warn(`Reddit RSS error for r/${subreddit}`, { error: err.message });
    return [];
  }
}

// ── Divisiveness scoring ──────────────────────────────────────────────────────
function scoreDivisiveness(post) {
  const { upvote_ratio = 0.5, num_comments = 0, score = 0 } = post;

  // Bimodality: ratio close to 0.5 = very divisive; close to 1 = consensus
  const ratioDivisiveness = 1 - Math.abs(upvote_ratio - 0.5) * 2;

  // Engagement weight (log-normalized)
  const engagementWeight = Math.min(Math.log10(num_comments + 1) / 4, 1);

  // Score dampening — very low score posts may be low visibility, not divisive
  const scoreWeight = score > 100 ? 1 : score / 100;

  return ratioDivisiveness * 0.6 + engagementWeight * 0.3 + scoreWeight * 0.1;
}

// ── Text normalization ────────────────────────────────────────────────────────
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOverlap(a, b) {
  const aWords = new Set(normalizeTitle(a).split(' ').filter(w => w.length > 3));
  const bWords = new Set(normalizeTitle(b).split(' ').filter(w => w.length > 3));
  let shared = 0;
  aWords.forEach(w => { if (bWords.has(w)) shared++; });
  return shared / Math.max(aWords.size, bWords.size, 1);
}

// ── Topic clustering ──────────────────────────────────────────────────────────
function clusterPosts(posts) {
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < posts.length; i++) {
    if (used.has(i)) continue;
    const cluster = [posts[i]];
    used.add(i);
    for (let j = i + 1; j < posts.length; j++) {
      if (used.has(j)) continue;
      if (titleOverlap(posts[i].title, posts[j].title) > 0.35) {
        cluster.push(posts[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }

  return clusters.map(cluster => {
    const avgDivisiveness = cluster.reduce((s, p) => s + scoreDivisiveness(p), 0) / cluster.length;
    const totalComments = cluster.reduce((s, p) => s + (p.num_comments || 0), 0);
    const representative = cluster.sort((a, b) => b.score - a.score)[0];
    return {
      title: representative.title,
      subreddits: [...new Set(cluster.map(p => p.subreddit))],
      divisiveness_score: avgDivisiveness,
      total_comments: totalComments,
      post_count: cluster.length,
      sample_url: representative.url || `https://reddit.com${representative.permalink || ''}`,
      upvote_ratio: representative.upvote_ratio,
    };
  });
}

// ── Main export ───────────────────────────────────────────────────────────────
async function scrapeReddit() {
  logger.info('Reddit scraper started');
  const allPosts = [];

  for (const sub of SUBREDDITS) {
    let posts = await fetchSubredditApi(sub, 'hot', 25);
    if (!posts) posts = await fetchSubredditRss(sub);
    if (posts) {
      allPosts.push(...posts.map(p => ({ ...p, subreddit: p.subreddit || sub })));
    }
    // Brief pause to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  logger.info(`Reddit: fetched ${allPosts.length} posts`);

  // Filter out sports/celebrity noise
  const NOISE_TERMS = /nfl|nba|nhl|mlb|oscar|grammy|celebrity|kardashian|taylor swift|super bowl/i;
  const filtered = allPosts.filter(p => !NOISE_TERMS.test(p.title));

  const clusters = clusterPosts(filtered);

  // Sort by combined divisiveness + engagement signal
  clusters.sort((a, b) => {
    const scoreA = a.divisiveness_score * 0.7 + Math.min(a.total_comments / 50000, 1) * 0.3;
    const scoreB = b.divisiveness_score * 0.7 + Math.min(b.total_comments / 50000, 1) * 0.3;
    return scoreB - scoreA;
  });

  const top = clusters.slice(0, 15);
  logger.info(`Reddit: returning ${top.length} topic candidates`);
  return top;
}

module.exports = { scrapeReddit };
