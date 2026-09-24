import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { computeDeadline } from '@/lib/timing';

interface QuizRow {
  id: number;
  time_limit_minutes: number;
  opens_at: string;
  closes_at: string;
  class_id: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'student' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const quizId = parseInt(id);
  const studentId = parseInt(session.sub);
  const db = getDb();
  const now = new Date().toISOString();

  const quiz = db.prepare(
    'SELECT id, time_limit_minutes, opens_at, closes_at, class_id FROM quizzes WHERE id = ?'
  ).get(quizId) as QuizRow | undefined;

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
  }

  // Check date window
  if (now < quiz.opens_at || now > quiz.closes_at) {
    return NextResponse.json({ error: 'Quiz is not currently open' }, { status: 403 });
  }

  // Check class (students only; admins can demo)
  if (session.role === 'student' && session.class_id !== quiz.class_id) {
    return NextResponse.json({ error: 'This quiz is not for your class' }, { status: 403 });
  }

  // Check for existing attempt
  const existing = db.prepare(
    'SELECT id, is_submitted, started_at FROM attempts WHERE student_id = ? AND quiz_id = ?'
  ).get(studentId, quizId) as { id: number; is_submitted: number; started_at: string } | undefined;

  if (existing?.is_submitted) {
    return NextResponse.json({ error: 'You have already completed this quiz' }, { status: 409 });
  }

  // If there's an in-progress attempt, check if time has expired
  if (existing && !existing.is_submitted) {
    const startedAt = new Date(existing.started_at);
    const deadline = computeDeadline(startedAt, quiz.time_limit_minutes, quiz.closes_at);
    if (new Date() > deadline) {
      // Auto-submit the expired attempt with whatever answers exist
      db.prepare(
        "UPDATE attempts SET is_submitted = 1, submitted_at = ? WHERE id = ?"
      ).run(now, existing.id);
      return NextResponse.json({ error: 'Your previous attempt has timed out and been submitted' }, { status: 409 });
    }
    // Return the existing in-progress attempt
    const questions = getQuestionsForAttempt(db, quizId);
    return NextResponse.json({
      attempt_id: existing.id,
      started_at: existing.started_at,
      deadline: deadline.toISOString(),
      questions,
      resumed: true,
    });
  }

  // Create new attempt
  const result = db.prepare(
    'INSERT INTO attempts (student_id, quiz_id, started_at) VALUES (?, ?, ?)'
  ).run(studentId, quizId, now);

  const attemptId = result.lastInsertRowid as number;
  const deadline = computeDeadline(now, quiz.time_limit_minutes, quiz.closes_at);
  const questions = getQuestionsForAttempt(db, quizId);

  return NextResponse.json({
    attempt_id: attemptId,
    started_at: now,
    deadline: deadline.toISOString(),
    questions,
    resumed: false,
  });
}

function getQuestionsForAttempt(db: ReturnType<typeof getDb>, quizId: number) {
  const questions = db.prepare(`
    SELECT id, body, points, order_index FROM questions WHERE quiz_id = ? ORDER BY order_index
  `).all(quizId) as { id: number; body: string; points: number; order_index: number }[];

  return questions.map((q) => {
    const options = db.prepare(
      'SELECT id, body FROM options WHERE question_id = ? ORDER BY id'
    ).all(q.id) as { id: number; body: string }[];
    // Shuffle options to reduce cheating
    const shuffled = options.sort(() => Math.random() - 0.5);
    return { ...q, options: shuffled };
  });
}
