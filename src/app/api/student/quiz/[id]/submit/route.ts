import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';
import { calculateScore, QuestionResult } from '@/lib/scoring';
import { computeDeadline, isLateSubmission } from '@/lib/timing';

interface AttemptRow {
  id: number;
  student_id: number;
  quiz_id: number;
  started_at: string;
  is_submitted: number;
}

interface QuizRow {
  id: number;
  time_limit_minutes: number;
  negative_marking: number;
  penalty_fraction: number;
  closes_at?: string;
}

interface QuestionRow {
  id: number;
  points: number;
}

interface OptionRow {
  id: number;
  question_id: number;
  is_correct: number;
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
  const now = new Date();

  const { attempt_id, answers } = await req.json() as {
    attempt_id: number;
    answers: Record<number, number | null>; // question_id -> option_id
  };

  // Verify attempt belongs to this student
  const attempt = db.prepare(
    'SELECT id, student_id, quiz_id, started_at, is_submitted FROM attempts WHERE id = ?'
  ).get(attempt_id) as AttemptRow | undefined;

  if (!attempt) {
    return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
  }
  if (attempt.student_id !== studentId || attempt.quiz_id !== quizId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (attempt.is_submitted) {
    return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
  }

  const quiz = db.prepare(
    'SELECT id, time_limit_minutes, negative_marking, penalty_fraction, closes_at FROM quizzes WHERE id = ?'
  ).get(quizId) as QuizRow;

  // Server-side timing verification with grace period buffer
  const deadline = computeDeadline(attempt.started_at, quiz.time_limit_minutes, quiz.closes_at);
  const isLate = isLateSubmission(now, deadline, 30);

  // Save answers and compute score in a transaction
  const submitTx = db.transaction(() => {
    const questions = db.prepare(
      'SELECT id, points FROM questions WHERE quiz_id = ?'
    ).all(quizId) as QuestionRow[];

    // For each question, upsert the answer
    for (const q of questions) {
      const selectedOptionId = answers[q.id] ?? null;
      db.prepare(`
        INSERT INTO answers (attempt_id, question_id, option_id)
        VALUES (?, ?, ?)
        ON CONFLICT(attempt_id, question_id) DO UPDATE SET option_id = excluded.option_id
      `).run(attempt_id, q.id, selectedOptionId);
    }

    // Fetch all options to determine correctness
    const allOptions = db.prepare(`
      SELECT o.id, o.question_id, o.is_correct
      FROM options o
      JOIN questions q ON o.question_id = q.id
      WHERE q.quiz_id = ?
    `).all(quizId) as OptionRow[];

    const correctByQuestion: Record<number, number> = {};
    for (const opt of allOptions) {
      if (opt.is_correct) correctByQuestion[opt.question_id] = opt.id;
    }

    const questionResults: QuestionResult[] = questions.map((q) => ({
      question_id: q.id,
      points: q.points,
      selected_option_id: answers[q.id] ?? null,
      correct_option_id: correctByQuestion[q.id],
    }));

    const result = calculateScore(
      questionResults,
      quiz.negative_marking === 1,
      quiz.penalty_fraction
    );

    db.prepare(`
      UPDATE attempts SET is_submitted = 1, submitted_at = ?, score = ?, max_score = ?, late_submission = ?
      WHERE id = ?
    `).run(now.toISOString(), result.score, result.max_score, isLate ? 1 : 0, attempt_id);

    return result;
  });

  const scoreResult = submitTx();

  return NextResponse.json({
    ok: true,
    is_late: isLate,
    ...scoreResult,
  });
}
