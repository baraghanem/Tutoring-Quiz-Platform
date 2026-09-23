import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'quiz.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar       TEXT NOT NULL,
      name_en       TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
      class_id      INTEGER REFERENCES classes(id),
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      title               TEXT NOT NULL,
      description         TEXT,
      teacher_id          INTEGER NOT NULL REFERENCES users(id),
      class_id            INTEGER NOT NULL REFERENCES classes(id),
      time_limit_minutes  INTEGER NOT NULL DEFAULT 20,
      opens_at            DATETIME NOT NULL,
      closes_at           DATETIME NOT NULL,
      negative_marking    INTEGER NOT NULL DEFAULT 0 CHECK(negative_marking IN (0,1)),
      penalty_fraction    REAL NOT NULL DEFAULT 0.25,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id     INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      points      REAL NOT NULL DEFAULT 1,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS options (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      body        TEXT NOT NULL,
      is_correct  INTEGER NOT NULL DEFAULT 0 CHECK(is_correct IN (0,1))
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id   INTEGER NOT NULL REFERENCES users(id),
      quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
      started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      submitted_at DATETIME,
      score        REAL,
      max_score    REAL,
      is_submitted INTEGER NOT NULL DEFAULT 0,
      UNIQUE(student_id, quiz_id)
    );

    CREATE TABLE IF NOT EXISTS answers (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id  INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id),
      option_id   INTEGER REFERENCES options(id),
      UNIQUE(attempt_id, question_id)
    );
  `);
}
