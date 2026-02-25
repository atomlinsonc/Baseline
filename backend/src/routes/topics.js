const express = require('express');
const router = express.Router();
const { getTodaysTopic, getTopicBySlug, listTopics, getCategories } = require('../db/queries');
const logger = require('../utils/logger');

// GET /api/topics — list/search archive
router.get('/', (req, res) => {
  try {
    const { page = '1', limit = '20', category, q, sort } = req.query;
    const result = listTopics({
      page: parseInt(page, 10),
      limit: Math.min(parseInt(limit, 10), 100),
      category,
      q,
      sort,
    });
    res.json(result);
  } catch (err) {
    logger.error('GET /topics failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// GET /api/topics/today — today's topic
router.get('/today', (req, res) => {
  try {
    const topic = getTodaysTopic();
    if (!topic) {
      return res.status(404).json({ error: 'No topic published today yet' });
    }
    // Enrich with full data
    const { getTopicById } = require('../db/queries');
    const full = getTopicById(topic.id);
    res.json(full);
  } catch (err) {
    logger.error('GET /topics/today failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch today\'s topic' });
  }
});

// GET /api/topics/categories
router.get('/categories', (req, res) => {
  try {
    const categories = getCategories();
    res.json(categories);
  } catch (err) {
    logger.error('GET /topics/categories failed', { error: err.message });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// GET /api/topics/:slug
router.get('/:slug', (req, res) => {
  try {
    const topic = getTopicBySlug(req.params.slug);
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    res.json(topic);
  } catch (err) {
    logger.error('GET /topics/:slug failed', { error: err.message, slug: req.params.slug });
    res.status(500).json({ error: 'Failed to fetch topic' });
  }
});

module.exports = router;
