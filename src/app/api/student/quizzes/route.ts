import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'student' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date().toISOString();

  // For admin, show all quizzes. For student, only their class
  let quizzes;
  if (session.role === 'admin') {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.description, q.time_limit_minutes,
             q.opens_at, q.closes_at, q.negative_marking, q.penalty_fraction,
             c.name AS class_name, u.name_en AS teacher_name_en, u.name_ar AS teacher_name_ar,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             NULL AS attempt_submitted_at, NULL AS attempt_score, NULL AS attempt_max_score
      FROM quizzes q
      JOIN classes c ON q.class_id = c.id
      JOIN users u ON q.teacher_id = u.id
      ORDER BY q.opens_at DESC
    `).all();
  } else {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.description, q.time_limit_minutes,
             q.opens_at, q.closes_at, q.negative_marking, q.penalty_fraction,
             c.name AS class_name, u.name_en AS teacher_name_en, u.name_ar AS teacher_name_ar,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             a.submitted_at AS attempt_submitted_at, a.score AS attempt_score, a.max_score AS attempt_max_score
      FROM quizzes q
      JOIN classes c ON q.class_id = c.id
      JOIN users u ON q.teacher_id = u.id
      LEFT JOIN attempts a ON a.quiz_id = q.id AND a.student_id = ?
      WHERE q.class_id = (SELECT class_id FROM users WHERE id = ?)
        AND q.opens_at <= ? AND q.closes_at >= ?
      ORDER BY q.closes_at ASC
    `).all(session.sub, session.sub, now, now);
  }

  return NextResponse.json({ quizzes });
}
