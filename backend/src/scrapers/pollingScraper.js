/**
 * Polling scraper — pulls public polling data from free sources.
 *
 * Sources:
 *  - FiveThirtyEight polls CSV (GitHub-hosted, public domain)
 *  - Pew Research RSS
 *  - RealClearPolitics HTML scraping
 *  - PollingReport.com (HTML)
 *
 * The AI processor will later match poll questions to the day's topic.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

const rssParser = new RSSParser();

// ── FiveThirtyEight (GitHub CSV) ──────────────────────────────────────────────
async function fetchFiveThirtyEight(topic) {
  // 538 hosts historical polling data on GitHub
  const POLLS_URL = 'https://projects.fivethirtyeight.com/polls/data/favorability_polls.csv';
  try {
    const resp = await axios.get(POLLS_URL, { timeout: 15000, responseType: 'text' });
    const lines = resp.data.split('\n').slice(1, 200); // Skip header, limit rows
    const polls = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
      // Check if relevant to topic
      const question = cols[3] || '';
      if (!question.toLowerCase().includes(topic.toLowerCase().split(' ')[0])) continue;

      polls.push({
        pollster: cols[1] || 'Unknown',
        question,
        date_range: cols[4] || '',
        source_url: 'https://projects.fivethirtyeight.com/polls/',
        topline_support: parseFloat(cols[6]) || null,
        topline_oppose: parseFloat(cols[7]) || null,
        raw_text: line,
      });
    }
    return polls;
  } catch (err) {
    logger.warn('FiveThirtyEight fetch failed', { error: err.message });
    return [];
  }
}

// ── Pew Research RSS ──────────────────────────────────────────────────────────
async function fetchPewResearch(topic) {
  try {
    const feed = await rssParser.parseURL('https://www.pewresearch.org/feed/');
    const topicWords = topic.toLowerCase().split(' ').filter(w => w.length > 3);

    return feed.items
      .filter(item => {
        const text = `${item.title} ${item.contentSnippet || ''}`.toLowerCase();
        return topicWords.some(w => text.includes(w));
      })
      .slice(0, 3)
      .map(item => ({
        pollster: 'Pew Research Center',
        question: item.title,
        date_range: item.pubDate ? new Date(item.pubDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
        source_url: item.link,
        topline_support: null,
        topline_oppose: null,
        raw_text: item.contentSnippet || '',
      }));
  } catch (err) {
    logger.warn('Pew Research fetch failed', { error: err.message });
    return [];
  }
}

// ── RealClearPolitics polling average ─────────────────────────────────────────
async function fetchRCPPollingAverage(topic) {
  // RCP has topic-specific pages; we do a search-based approach
  try {
    const searchUrl = `https://www.realclearpolling.com/search?q=${encodeURIComponent(topic)}`;
    const resp = await axios.get(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Baseline/1.0)' },
      timeout: 10000,
    });

    const $ = cheerio.load(resp.data);
    const polls = [];

    // Extract poll table rows if present
    $('table.polls-table tr, .polling-data-table tr').each((i, row) => {
      if (i === 0) return; // skip header
      const cells = $(row).find('td').map((_, td) => $(td).text().trim()).get();
      if (cells.length >= 4) {
        polls.push({
          pollster: cells[0],
          question: topic,
          date_range: cells[1],
          source_url: searchUrl,
          topline_support: parseFloat(cells[2]) || null,
          topline_oppose: parseFloat(cells[3]) || null,
          raw_text: cells.join(' | '),
        });
      }
    });

    return polls.slice(0, 5);
  } catch (err) {
    logger.warn('RCP fetch failed', { error: err.message });
    return [];
  }
}

// ── Main: aggregate polling data for a topic ──────────────────────────────────
async function scrapePollingData(topicTitle) {
  logger.info('Polling scraper started', { topic: topicTitle });

  const [ftePolls, pewPolls, rcpPolls] = await Promise.allSettled([
    fetchFiveThirtyEight(topicTitle),
    fetchPewResearch(topicTitle),
    fetchRCPPollingAverage(topicTitle),
  ]);

  const all = [
    ...(ftePolls.status === 'fulfilled' ? ftePolls.value : []),
    ...(pewPolls.status === 'fulfilled' ? pewPolls.value : []),
    ...(rcpPolls.status === 'fulfilled' ? rcpPolls.value : []),
  ];

  logger.info(`Polling: found ${all.length} polls`);
  return all;
}

module.exports = { scrapePollingData };
