import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── Inline schema for isolated test DB ──────────────────────────────────────
const TEST_DB_PATH = path.join(process.cwd(), 'tests', '.test-quiz.db');

function createTestDb() {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE classes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name_ar TEXT, name_en TEXT,
      email TEXT UNIQUE, password_hash TEXT, role TEXT, class_id INTEGER REFERENCES classes(id)
    );
    CREATE TABLE quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT,
      teacher_id INTEGER REFERENCES users(id), class_id INTEGER REFERENCES classes(id),
      time_limit_minutes INTEGER DEFAULT 20,
      opens_at DATETIME, closes_at DATETIME,
      negative_marking INTEGER DEFAULT 0, penalty_fraction REAL DEFAULT 0.25,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id INTEGER REFERENCES quizzes(id) ON DELETE CASCADE,
      body TEXT, points REAL DEFAULT 1, order_index INTEGER DEFAULT 0
    );
    CREATE TABLE options (
      id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      body TEXT, is_correct INTEGER DEFAULT 0
    );
    CREATE TABLE attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER REFERENCES users(id), quiz_id INTEGER REFERENCES quizzes(id),
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP, submitted_at DATETIME,
      score REAL, max_score REAL, is_submitted INTEGER DEFAULT 0,
      UNIQUE(student_id, quiz_id)
    );
    CREATE TABLE answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, attempt_id INTEGER REFERENCES attempts(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES questions(id), option_id INTEGER REFERENCES options(id),
      UNIQUE(attempt_id, question_id)
    );
  `);
  return db;
}

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

afterEach(() => {
  db.close();
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function insertClass(name: string) {
  return (db.prepare('INSERT INTO classes (name) VALUES (?)').run(name).lastInsertRowid as number);
}

function insertUser(email: string, role: string, classId?: number) {
  return (db.prepare(
    'INSERT INTO users (name_ar, name_en, email, password_hash, role, class_id) VALUES (?,?,?,?,?,?)'
  ).run('اسم', 'Name', email, 'hash', role, classId ?? null).lastInsertRowid as number);
}

function insertQuiz(
  teacherId: number, classId: number,
  opensAt: string, closesAt: string,
  negMarking = 0
) {
  return (db.prepare(`
    INSERT INTO quizzes (title, teacher_id, class_id, time_limit_minutes, opens_at, closes_at, negative_marking)
    VALUES ('Test Quiz', ?, ?, 20, ?, ?, ?)
  `).run(teacherId, classId, opensAt, closesAt, negMarking).lastInsertRowid as number);
}

function insertQuestionWithOptions(quizId: number, points = 1): { questionId: number; correctOptionId: number } {
  const qId = db.prepare(
    'INSERT INTO questions (quiz_id, body, points, order_index) VALUES (?, ?, ?, 0)'
  ).run(quizId, 'Sample question', points).lastInsertRowid as number;
  const correctId = db.prepare(
    'INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, 1)'
  ).run(qId, 'Correct').lastInsertRowid as number;
  db.prepare('INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, 0)').run(qId, 'Wrong A');
  db.prepare('INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, 0)').run(qId, 'Wrong B');
  db.prepare('INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, 0)').run(qId, 'Wrong C');
  return { questionId: qId, correctOptionId: correctId };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('database: attempt uniqueness', () => {
  it('enforces UNIQUE(student_id, quiz_id) at DB level', () => {
    const classId = insertClass('10A');
    const teacherId = insertUser('teacher@t.com', 'teacher');
    const studentId = insertUser('student@s.com', 'student', classId);
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const quizId = insertQuiz(teacherId, classId, past, future);

    db.prepare('INSERT INTO attempts (student_id, quiz_id) VALUES (?, ?)').run(studentId, quizId);

    expect(() => {
      db.prepare('INSERT INTO attempts (student_id, quiz_id) VALUES (?, ?)').run(studentId, quizId);
    }).toThrow();
  });

  it('allows different students to take the same quiz', () => {
    const classId = insertClass('10A');
    const teacherId = insertUser('teacher@t.com', 'teacher');
    const s1 = insertUser('s1@s.com', 'student', classId);
    const s2 = insertUser('s2@s.com', 'student', classId);
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const quizId = insertQuiz(teacherId, classId, past, future);

    db.prepare('INSERT INTO attempts (student_id, quiz_id) VALUES (?, ?)').run(s1, quizId);
    db.prepare('INSERT INTO attempts (student_id, quiz_id) VALUES (?, ?)').run(s2, quizId);

    const count = (db.prepare('SELECT COUNT(*) as n FROM attempts WHERE quiz_id = ?').get(quizId) as { n: number }).n;
    expect(count).toBe(2);
  });
});

describe('database: quiz window enforcement', () => {
  it('correctly identifies currently open quizzes', () => {
    const classId = insertClass('10A');
    const teacherId = insertUser('teacher@t.com', 'teacher');
    const past = new Date(Date.now() - 3600000).toISOString();  // 1hr ago
    const future = new Date(Date.now() + 3600000).toISOString(); // 1hr from now
    const farPast = new Date(Date.now() - 86400000 * 2).toISOString();
    const slightlyPast = new Date(Date.now() - 60000).toISOString(); // 1min ago

    const openQuizId = insertQuiz(teacherId, classId, past, future);
    const closedQuizId = insertQuiz(teacherId, classId, farPast, slightlyPast);
    const upcomingQuizId = insertQuiz(teacherId, classId, future, new Date(Date.now() + 86400000).toISOString());

    const now = new Date().toISOString();
    const open = db.prepare('SELECT id FROM quizzes WHERE opens_at <= ? AND closes_at >= ?').all(now, now) as { id: number }[];
    const openIds = open.map((q) => q.id);

    expect(openIds).toContain(openQuizId);
    expect(openIds).not.toContain(closedQuizId);
    expect(openIds).not.toContain(upcomingQuizId);
  });
});

describe('database: cascade deletes', () => {
  it('deletes questions and options when quiz is deleted', () => {
    const classId = insertClass('10A');
    const teacherId = insertUser('teacher@t.com', 'teacher');
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const quizId = insertQuiz(teacherId, classId, past, future);
    insertQuestionWithOptions(quizId);

    db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);

    const qCount = (db.prepare('SELECT COUNT(*) as n FROM questions WHERE quiz_id = ?').get(quizId) as { n: number }).n;
    expect(qCount).toBe(0);
  });
});

describe('database: class filtering', () => {
  it('only shows quizzes for the student\'s class', () => {
    const classA = insertClass('10A');
    const classB = insertClass('10B');
    const teacherId = insertUser('teacher@t.com', 'teacher');
    const studentId = insertUser('student@s.com', 'student', classA);

    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 86400000).toISOString();
    const quizForA = insertQuiz(teacherId, classA, past, future);
    const quizForB = insertQuiz(teacherId, classB, past, future);

    const now = new Date().toISOString();
    const visible = db.prepare(`
      SELECT q.id FROM quizzes q
      WHERE q.class_id = (SELECT class_id FROM users WHERE id = ?)
        AND q.opens_at <= ? AND q.closes_at >= ?
    `).all(studentId, now, now) as { id: number }[];

    const ids = visible.map((q) => q.id);
    expect(ids).toContain(quizForA);
    expect(ids).not.toContain(quizForB);
  });
});
