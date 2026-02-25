/**
 * Google Trends scraper.
 *
 * Primary: SerpAPI (100 free requests/month — enough for daily runs).
 * Fallback: Scrape trends.google.com RSS feed (no auth needed).
 *
 * Returns an array of trending topic strings with relative interest scores.
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

const rssParser = new RSSParser();

// ── SerpAPI ───────────────────────────────────────────────────────────────────
async function fetchViaSerpApi() {
  const { SERPAPI_KEY } = process.env;
  if (!SERPAPI_KEY) return null;

  try {
    const resp = await axios.get('https://serpapi.com/search.json', {
      params: {
        engine: 'google_trends_trending_now',
        geo: 'US',
        api_key: SERPAPI_KEY,
      },
      timeout: 15000,
    });

    const items = resp.data.trending_searches || [];
    return items.slice(0, 20).map((item, i) => ({
      title: item.query || item.title?.query || String(item),
      score: 100 - i * 3,
      source: 'google_trends_serpapi',
    }));
  } catch (err) {
    logger.warn('SerpAPI Google Trends failed', { error: err.message });
    return null;
  }
}

// ── RSS fallback (geo=US daily trending) ─────────────────────────────────────
async function fetchViaRss() {
  try {
    const feed = await rssParser.parseURL(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=US'
    );
    return feed.items.slice(0, 20).map((item, i) => {
      // RSS items have <ht:approx_traffic> for search volume
      const traffic = item['ht:approx_traffic'] || item['approx_traffic'] || '0';
      const volume = parseInt(String(traffic).replace(/[^0-9]/g, ''), 10) || 0;
      return {
        title: item.title,
        score: Math.min(volume / 1000, 100),
        source: 'google_trends_rss',
        news_items: item['ht:news_item'] || [],
      };
    });
  } catch (err) {
    logger.warn('Google Trends RSS failed', { error: err.message });
    return [];
  }
}

// ── Filter: keep only policy/societal topics ──────────────────────────────────
function filterTopics(trends) {
  const NOISE = /weather|sports|nfl|nba|recipe|movie|actor|singer|celebrity|game|score|match|fashion/i;
  const SIGNAL = /law|bill|policy|rights|immigration|healthcare|climate|gun|abortion|tax|election|vote|economy|inflation|war|crisis|court|congress|senate|president|ban|regulation|reform/i;

  return trends.filter(t => {
    const noNoise = !NOISE.test(t.title);
    const hasSignal = SIGNAL.test(t.title);
    return noNoise && (hasSignal || t.score > 60);
  });
}

async function scrapeGoogleTrends() {
  logger.info('Google Trends scraper started');

  let trends = await fetchViaSerpApi();
  if (!trends || trends.length === 0) {
    logger.info('Google Trends: falling back to RSS');
    trends = await fetchViaRss();
  }

  const filtered = filterTopics(trends);
  logger.info(`Google Trends: returning ${filtered.length} candidates`);
  return filtered;
}

module.exports = { scrapeGoogleTrends };
