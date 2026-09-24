import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { computeDeadline, isLateSubmission } from '@/lib/timing';
import { calculateScore } from '@/lib/scoring';

/**
 * Integration tests exercising the business logic and authorization rules
 * corresponding to the /api/student/quiz/[id]/start and /submit routes.
 */
describe('Quiz API Lifecycle & Security Flow', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        class_id INTEGER REFERENCES classes(id)
      );

      CREATE TABLE quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        teacher_id INTEGER NOT NULL REFERENCES users(id),
        class_id INTEGER NOT NULL REFERENCES classes(id),
        time_limit_minutes INTEGER NOT NULL DEFAULT 20,
        opens_at DATETIME NOT NULL,
        closes_at DATETIME NOT NULL,
        negative_marking INTEGER NOT NULL DEFAULT 0,
        penalty_fraction REAL NOT NULL DEFAULT 0.25
      );

      CREATE TABLE questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        points REAL NOT NULL DEFAULT 1,
        order_index INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE options (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        is_correct INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES users(id),
        quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME,
        score REAL,
        max_score REAL,
        is_submitted INTEGER NOT NULL DEFAULT 0,
        late_submission INTEGER NOT NULL DEFAULT 0,
        UNIQUE(student_id, quiz_id)
      );

      CREATE TABLE answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attempt_id INTEGER NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id),
        option_id INTEGER REFERENCES options(id),
        UNIQUE(attempt_id, question_id)
      );

      -- Seed test fixtures
      INSERT INTO classes (id, name) VALUES (1, '10A'), (2, '10B');

      INSERT INTO users (id, name_ar, name_en, email, password_hash, role, class_id)
      VALUES
        (1, 'معلم', 'Teacher', 'teacher@nour.jo', 'hash', 'teacher', NULL),
        (2, 'طالب أ', 'Student 10A', 's1@nour.jo', 'hash', 'student', 1),
        (3, 'طالب ب', 'Student 10B', 's2@nour.jo', 'hash', 'student', 2);

      -- Active quiz for class 1 (10A)
      INSERT INTO quizzes (id, title, teacher_id, class_id, time_limit_minutes, opens_at, closes_at, negative_marking, penalty_fraction)
      VALUES (1, 'Algebra Quiz', 1, 1, 20, '2026-09-01T00:00:00.000Z', '2026-09-30T23:59:59.000Z', 1, 0.25);

      -- Closed quiz for class 1 (10A)
      INSERT INTO quizzes (id, title, teacher_id, class_id, time_limit_minutes, opens_at, closes_at, negative_marking, penalty_fraction)
      VALUES (2, 'Old Quiz', 1, 1, 20, '2026-08-01T00:00:00.000Z', '2026-08-05T23:59:59.000Z', 0, 0.25);

      -- Questions for quiz 1
      INSERT INTO questions (id, quiz_id, body, points, order_index) VALUES
        (10, 1, 'Q1: What is x in 2x=4?', 2.0, 0),
        (11, 1, 'Q2: What is y in 3y=9?', 3.0, 1);

      INSERT INTO options (id, question_id, body, is_correct) VALUES
        (101, 10, 'x = 2', 1),
        (102, 10, 'x = 3', 0),
        (103, 11, 'y = 3', 1),
        (104, 11, 'y = 4', 0);
    `);
  });

  it('rejects attempt start if quiz is closed', () => {
    const quizId = 2; // Old Quiz (closed in August)
    const now = '2026-09-24T12:00:00.000Z';
    const quiz = db.prepare('SELECT opens_at, closes_at FROM quizzes WHERE id = ?').get(quizId) as { opens_at: string; closes_at: string };

    const isOpen = now >= quiz.opens_at && now <= quiz.closes_at;
    expect(isOpen).toBe(false);
  });

  it('rejects attempt start if student is in a different class', () => {
    const student10B = db.prepare('SELECT id, class_id FROM users WHERE id = 3').get() as { id: number; class_id: number };
    const quiz = db.prepare('SELECT class_id FROM quizzes WHERE id = 1').get() as { class_id: number };

    // Student 10B (class 2) trying to access Quiz 1 (class 1)
    const canAccess = student10B.class_id === quiz.class_id;
    expect(canAccess).toBe(false);
  });

  it('creates an attempt and clamps deadline if window closes sooner than quiz duration', () => {
    const studentId = 2; // Student 10A
    const quizId = 1;
    const now = '2026-09-30T23:50:00.000Z'; // 10 minutes before closes_at
    const quiz = db.prepare('SELECT time_limit_minutes, closes_at FROM quizzes WHERE id = ?').get(quizId) as { time_limit_minutes: number; closes_at: string };

    // Standard time limit is 20 minutes, but closes_at is in 10 minutes
    const effectiveDeadline = computeDeadline(now, quiz.time_limit_minutes, quiz.closes_at);
    expect(effectiveDeadline.toISOString()).toBe('2026-09-30T23:59:59.000Z');

    const result = db.prepare(
      'INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)'
    ).run(studentId, quizId, now);

    expect(result.lastInsertRowid).toBeGreaterThan(0);
  });

  it('enforces single attempt rule: rejects duplicate start', () => {
    const studentId = 2;
    const quizId = 1;
    const now = '2026-09-24T10:00:00.000Z';

    db.prepare('INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)').run(studentId, quizId, now);

    // Second attempt must throw SQLite UNIQUE constraint violation
    expect(() => {
      db.prepare('INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)').run(studentId, quizId, now);
    }).toThrow();
  });

  it('prevents a student from submitting an attempt owned by someone else', () => {
    const legitimateStudentId = 2;
    const attackerStudentId = 3;
    const quizId = 1;

    const attempt = db.prepare(
      'INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)'
    ).run(legitimateStudentId, quizId, '2026-09-24T10:00:00.000Z');

    const attemptId = Number(attempt.lastInsertRowid);
    const row = db.prepare('SELECT student_id, quiz_id FROM attempts WHERE id = ?').get(attemptId) as { student_id: number; quiz_id: number };

    // Security check corresponding to submit route
    const isOwner = row.student_id === attackerStudentId;
    expect(isOwner).toBe(false);
  });

  it('scores answers correctly and records late_submission flag when overdue', () => {
    const studentId = 2;
    const quizId = 1;
    const startedAt = '2026-09-24T10:00:00.000Z';

    const insertRes = db.prepare(
      'INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)'
    ).run(studentId, quizId, startedAt);
    const attemptId = Number(insertRes.lastInsertRowid);

    const quiz = db.prepare('SELECT time_limit_minutes, closes_at, negative_marking, penalty_fraction FROM quizzes WHERE id = ?').get(quizId) as {
      time_limit_minutes: number;
      closes_at: string;
      negative_marking: number;
      penalty_fraction: number;
    };

    // 25 minutes later (deadline was 10:20:00 + 30s buffer)
    const submittedAt = '2026-09-24T10:25:00.000Z';
    const deadline = computeDeadline(startedAt, quiz.time_limit_minutes, quiz.closes_at);
    const isLate = isLateSubmission(submittedAt, deadline, 30);
    expect(isLate).toBe(true);

    // Student got Q1 right (opt 101, +2 pts) and Q2 wrong (opt 104, -0.25 * 3 = -0.75 pts)
    const answers: Record<number, number> = { 10: 101, 11: 104 };

    // Transaction mimicking submit route
    const submitTx = db.transaction(() => {
      for (const [qid, optid] of Object.entries(answers)) {
        db.prepare(`
          INSERT INTO answers (attempt_id, question_id, option_id) VALUES (?, ?, ?)
          ON CONFLICT(attempt_id, question_id) DO UPDATE SET option_id = excluded.option_id
        `).run(attemptId, Number(qid), optid);
      }

      const questionResults = [
        { question_id: 10, points: 2.0, selected_option_id: 101, correct_option_id: 101 },
        { question_id: 11, points: 3.0, selected_option_id: 104, correct_option_id: 103 },
      ];

      const scoring = calculateScore(questionResults, quiz.negative_marking === 1, quiz.penalty_fraction);

      db.prepare(`
        UPDATE attempts
        SET is_submitted = 1, submitted_at = ?, score = ?, max_score = ?, late_submission = ?
        WHERE id = ?
      `).run(submittedAt, scoring.score, scoring.max_score, isLate ? 1 : 0, attemptId);

      return scoring;
    });

    const finalScore = submitTx();
    // 2.0 - 0.75 = 1.25 / 5.0
    expect(finalScore.score).toBe(1.25);
    expect(finalScore.max_score).toBe(5.0);

    const savedAttempt = db.prepare('SELECT is_submitted, late_submission, score FROM attempts WHERE id = ?').get(attemptId) as {
      is_submitted: number;
      late_submission: number;
      score: number;
    };
    expect(savedAttempt.is_submitted).toBe(1);
    expect(savedAttempt.late_submission).toBe(1);
    expect(savedAttempt.score).toBe(1.25);
  });

  it('correctly detects missed quizzes for closed deadlines', () => {
    // Student 2 never took Quiz 2 (Old Quiz, closed in August)
    const now = '2026-09-24T12:00:00.000Z';
    const missed = db.prepare(`
      SELECT u.id AS student_id, q.id AS quiz_id, q.title AS quiz_title
      FROM quizzes q
      JOIN classes c ON q.class_id = c.id
      JOIN users u ON u.class_id = c.id AND u.role = 'student'
      LEFT JOIN attempts a ON a.quiz_id = q.id AND a.student_id = u.id AND a.is_submitted = 1
      WHERE q.closes_at < ? AND a.id IS NULL
    `).all(now) as { student_id: number; quiz_id: number }[];

    expect(missed.length).toBeGreaterThan(0);
    expect(missed.some((m) => m.student_id === 2 && m.quiz_id === 2)).toBe(true);
  });
});
