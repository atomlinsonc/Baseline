/**
 * Database schema initialization.
 * Uses better-sqlite3 for synchronous SQLite access.
 * All schema changes are additive (ALTER TABLE) to preserve data.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Default: backend/data/baseline.db (relative to this file's location)
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/baseline.db');

function getDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- ── Topics ────────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS topics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT    NOT NULL UNIQUE,
      title       TEXT    NOT NULL,
      date        TEXT    NOT NULL,          -- ISO date YYYY-MM-DD
      category    TEXT    NOT NULL,
      summary     TEXT    NOT NULL,          -- 2–3 sentence why-it's-trending
      trending_reason TEXT NOT NULL,         -- detailed sourcing narrative
      divisiveness_score REAL DEFAULT 0,    -- 0–1 bimodality score
      status      TEXT    NOT NULL DEFAULT 'published', -- published | draft
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Trend signals (raw scores that drove topic selection) ─────────────────
    CREATE TABLE IF NOT EXISTS trend_signals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      source      TEXT    NOT NULL,          -- reddit | youtube | google_trends
      signal_type TEXT    NOT NULL,          -- trending_score | divisiveness | engagement
      value       REAL    NOT NULL,
      metadata    TEXT,                      -- JSON blob of raw signal data
      fetched_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Polling data ──────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS polls (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      pollster    TEXT    NOT NULL,
      question    TEXT    NOT NULL,
      date_range  TEXT,                      -- "Jan 2024" or "Jan 1-5, 2024"
      source_url  TEXT,
      topline_support   REAL,               -- % supporting/favoring (0–100)
      topline_oppose    REAL,               -- % opposing
      topline_neutral   REAL,               -- % neutral/unsure
      demographics TEXT,                    -- JSON: {age:{18-29:X,...}, party:{...}, ...}
      raw_text     TEXT                     -- original question wording
    );

    -- ── Arguments (top-level claims on each side) ─────────────────────────────
    CREATE TABLE IF NOT EXISTS arguments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      side        TEXT    NOT NULL,          -- "pro" | "con"
      position    INTEGER NOT NULL DEFAULT 0, -- display order
      headline    TEXT    NOT NULL,          -- short claim statement
      summary     TEXT    NOT NULL           -- 1–2 sentence elaboration
    );

    -- ── Sub-claims (fact-checked individual claims under each argument) ────────
    CREATE TABLE IF NOT EXISTS claims (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      argument_id INTEGER NOT NULL REFERENCES arguments(id) ON DELETE CASCADE,
      topic_id    INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL DEFAULT 0,
      statement   TEXT    NOT NULL,
      verdict     TEXT    NOT NULL,          -- supported|mostly_supported|contested|mostly_unsupported|unsupported|unverifiable
      verdict_explanation TEXT NOT NULL,
      is_values_based INTEGER NOT NULL DEFAULT 0, -- 1 = unverifiable/philosophical
      sources     TEXT    NOT NULL           -- JSON array of {name, url, verdict}
    );

    -- ── Categories lookup ─────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS categories (
      slug  TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT
    );

    -- ── Scheduler log ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS run_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date    TEXT    NOT NULL,
      status      TEXT    NOT NULL,          -- success | error | skipped
      topic_id    INTEGER REFERENCES topics(id),
      error_msg   TEXT,
      duration_ms INTEGER,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default categories
  const insertCat = db.prepare(`
    INSERT OR IGNORE INTO categories (slug, label, description) VALUES (?, ?, ?)
  `);
  const defaultCategories = [
    ['social-issues',       'Social Issues',        'Debates about culture, identity, and social norms'],
    ['economic-policy',     'Economic Policy',      'Taxation, labor, trade, and fiscal debates'],
    ['foreign-policy',      'Foreign Policy',       'International relations, defense, and diplomacy'],
    ['civil-rights',        'Civil Rights',         'Rights, liberties, and equal protection debates'],
    ['science-technology',  'Science & Technology', 'AI, climate, health tech, and scientific consensus debates'],
    ['religion',            'Religion & Values',    'Debates touching on faith, morality, and values'],
    ['healthcare',          'Healthcare',           'Insurance, access, costs, and medical policy'],
    ['immigration',         'Immigration',          'Border policy, asylum, citizenship debates'],
    ['education',           'Education',            'School policy, curriculum, and access debates'],
    ['environment',         'Environment',          'Climate, conservation, and energy policy'],
  ];
  const insertMany = db.transaction((cats) => {
    for (const c of cats) insertCat.run(...c);
  });
  insertMany(defaultCategories);

  logger.info('Database initialized', { path: DB_PATH });
  return db;
}

module.exports = { getDb, initDb };
