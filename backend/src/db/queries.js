/**
 * All database read/write operations.
 * Keeps SQL out of business logic — import these functions instead of raw db calls.
 */

const { getDb } = require('./schema');

// ── Topics ────────────────────────────────────────────────────────────────────

function getTodaysTopic() {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  return db.prepare(`
    SELECT * FROM topics WHERE date = ? AND status = 'published' LIMIT 1
  `).get(today);
}

function getTopicBySlug(slug) {
  const db = getDb();
  const topic = db.prepare(`SELECT * FROM topics WHERE slug = ? AND status = 'published'`).get(slug);
  if (!topic) return null;
  return enrichTopic(topic);
}

function getTopicById(id) {
  const db = getDb();
  const topic = db.prepare(`SELECT * FROM topics WHERE id = ?`).get(id);
  if (!topic) return null;
  return enrichTopic(topic);
}

function enrichTopic(topic) {
  const db = getDb();
  const polls = db.prepare(`SELECT * FROM polls WHERE topic_id = ?`).all(topic.id);
  const args  = db.prepare(`SELECT * FROM arguments WHERE topic_id = ? ORDER BY side, position`).all(topic.id);
  const claims = db.prepare(`SELECT * FROM claims WHERE topic_id = ? ORDER BY argument_id, position`).all(topic.id);

  // Parse JSON fields
  const parsedPolls = polls.map(p => ({
    ...p,
    demographics: safeJson(p.demographics),
  }));
  const parsedArgs = args.map(a => ({
    ...a,
    claims: claims
      .filter(c => c.argument_id === a.id)
      .map(c => ({ ...c, sources: safeJson(c.sources) })),
  }));

  return {
    ...topic,
    polls: parsedPolls,
    arguments: {
      pro: parsedArgs.filter(a => a.side === 'pro'),
      con: parsedArgs.filter(a => a.side === 'con'),
    },
  };
}

function listTopics({ page = 1, limit = 20, category, q, sort = 'date_desc' } = {}) {
  const db = getDb();
  const offset = (page - 1) * limit;
  const conditions = [`status = 'published'`];
  const params = [];

  if (category) {
    conditions.push(`category = ?`);
    params.push(category);
  }
  if (q) {
    conditions.push(`(title LIKE ? OR summary LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = sort === 'date_asc' ? 'date ASC' : 'date DESC';

  const total = db.prepare(`SELECT COUNT(*) as n FROM topics ${where}`).get(...params).n;
  const items = db.prepare(`
    SELECT id, slug, title, date, category, summary, divisiveness_score
    FROM topics ${where}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

function insertTopic(data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO topics (slug, title, date, category, summary, trending_reason, divisiveness_score, status)
    VALUES (@slug, @title, @date, @category, @summary, @trending_reason, @divisiveness_score, @status)
  `);
  const result = stmt.run(data);
  return result.lastInsertRowid;
}

function topicExistsForDate(date) {
  const db = getDb();
  return !!db.prepare(`SELECT 1 FROM topics WHERE date = ? AND status = 'published'`).get(date);
}

// ── Polls ─────────────────────────────────────────────────────────────────────

function insertPoll(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO polls (topic_id, pollster, question, date_range, source_url, topline_support, topline_oppose, topline_neutral, demographics, raw_text)
    VALUES (@topic_id, @pollster, @question, @date_range, @source_url, @topline_support, @topline_oppose, @topline_neutral, @demographics, @raw_text)
  `).run(data);
}

// ── Arguments & Claims ────────────────────────────────────────────────────────

function insertArgument(data) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO arguments (topic_id, side, position, headline, summary)
    VALUES (@topic_id, @side, @position, @headline, @summary)
  `).run(data);
  return result.lastInsertRowid;
}

function insertClaim(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO claims (argument_id, topic_id, position, statement, verdict, verdict_explanation, is_values_based, sources)
    VALUES (@argument_id, @topic_id, @position, @statement, @verdict, @verdict_explanation, @is_values_based, @sources)
  `).run(data);
}

// ── Trend Signals ─────────────────────────────────────────────────────────────

function insertTrendSignal(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO trend_signals (topic_id, source, signal_type, value, metadata)
    VALUES (@topic_id, @source, @signal_type, @value, @metadata)
  `).run(data);
}

// ── Run Log ───────────────────────────────────────────────────────────────────

function logRun(data) {
  const db = getDb();
  db.prepare(`
    INSERT INTO run_log (run_date, status, topic_id, error_msg, duration_ms)
    VALUES (@run_date, @status, @topic_id, @error_msg, @duration_ms)
  `).run(data);
}

function getRecentRuns(limit = 10) {
  const db = getDb();
  return db.prepare(`SELECT * FROM run_log ORDER BY created_at DESC LIMIT ?`).all(limit);
}

// ── Categories ────────────────────────────────────────────────────────────────

function getCategories() {
  const db = getDb();
  return db.prepare(`SELECT * FROM categories ORDER BY label`).all();
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function safeJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); }
  catch { return null; }
}

module.exports = {
  getTodaysTopic,
  getTopicBySlug,
  getTopicById,
  listTopics,
  insertTopic,
  topicExistsForDate,
  insertPoll,
  insertArgument,
  insertClaim,
  insertTrendSignal,
  logRun,
  getRecentRuns,
  getCategories,
};
