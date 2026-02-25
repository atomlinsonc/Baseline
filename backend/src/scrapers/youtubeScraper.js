/**
 * YouTube scraper — pulls trending political/news content.
 *
 * Uses YouTube Data API v3 (free, 10k units/day).
 * Falls back to scraping YouTube's trending RSS feed.
 *
 * Divisiveness signal: comment-to-view ratio + like-to-dislike proxy
 * (YouTube removed public dislike counts; we use comment density as proxy).
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const logger = require('../utils/logger');

const rssParser = new RSSParser();

// News/politics-related YouTube channel IDs to sample
const CHANNEL_IDS = [
  'UCXIJgqnII2ZOINSWNOGFThA', // Fox News
  'UCVTyTA7KZpC4yvubITZBGYg', // ABC News
  'UCeY0bbntWzzVIaj2z3QigXg', // NBC News
  'UC16niRr50-MSBwiO3YDb3RA', // BBC News
  'UCupvZG-5ko_eiXAupbDfxWw', // CNN
  'UCHd62-u_v4DvJ8TCFtpi4GA', // MSNBC
  'UC3XTzVzaHQEd30rQbuvCtTQ', // LastWeekTonight
  'UCF9IOB2TExg3QIBupFtBDxg', // PBSNewsHour
];

// ── API fetch ─────────────────────────────────────────────────────────────────
async function fetchTrendingVideos() {
  const { YOUTUBE_API_KEY } = process.env;
  if (!YOUTUBE_API_KEY) return null;

  try {
    // Get trending videos in the News & Politics category (cat 25)
    const resp = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'snippet,statistics',
        chart: 'mostPopular',
        regionCode: 'US',
        videoCategoryId: '25', // News & Politics
        maxResults: 50,
        key: YOUTUBE_API_KEY,
      },
      timeout: 10000,
    });

    return resp.data.items.map(video => {
      const stats = video.statistics;
      const viewCount = parseInt(stats.viewCount || '0', 10);
      const commentCount = parseInt(stats.commentCount || '0', 10);
      const likeCount = parseInt(stats.likeCount || '0', 10);

      // Comment density as divisiveness proxy (high comments per view = polarizing)
      const commentDensity = viewCount > 0 ? commentCount / viewCount : 0;
      const divisiveness = Math.min(commentDensity * 1000, 1);

      return {
        title: video.snippet.title,
        channel: video.snippet.channelTitle,
        description: video.snippet.description?.slice(0, 200),
        viewCount,
        commentCount,
        likeCount,
        divisiveness_score: divisiveness,
        published_at: video.snippet.publishedAt,
        video_id: video.id,
        source: 'youtube_api',
      };
    });
  } catch (err) {
    logger.warn('YouTube API error', { error: err.message });
    return null;
  }
}

// ── RSS fallback ──────────────────────────────────────────────────────────────
async function fetchViaRss() {
  const results = [];
  for (const channelId of CHANNEL_IDS.slice(0, 4)) {
    try {
      const feed = await rssParser.parseURL(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
      );
      const items = feed.items.slice(0, 5).map(item => ({
        title: item.title,
        channel: feed.title,
        divisiveness_score: 0.4, // neutral default without stats
        published_at: item.pubDate,
        source: 'youtube_rss',
      }));
      results.push(...items);
    } catch (err) {
      logger.warn(`YouTube RSS error for channel ${channelId}`, { error: err.message });
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return results;
}

// ── Filter noise ──────────────────────────────────────────────────────────────
function filterVideos(videos) {
  const NOISE = /vlog|cooking|gaming|makeup|music video|trailer|review|unboxing|prank/i;
  const POLICY = /congress|senate|president|supreme court|election|policy|law|bill|vote|immigration|economy|climate|healthcare|gun|abortion|rights|crisis|war|budget|inflation/i;

  return videos.filter(v => {
    const text = `${v.title} ${v.description || ''}`;
    return !NOISE.test(text) && (POLICY.test(text) || v.divisiveness_score > 0.5);
  });
}

async function scrapeYoutube() {
  logger.info('YouTube scraper started');

  let videos = await fetchTrendingVideos();
  if (!videos || videos.length === 0) {
    logger.info('YouTube: falling back to RSS');
    videos = await fetchViaRss();
  }

  const filtered = filterVideos(videos || []);
  logger.info(`YouTube: returning ${filtered.length} candidates`);
  return filtered;
}

module.exports = { scrapeYoutube };
