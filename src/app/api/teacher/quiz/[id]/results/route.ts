import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const quizId = parseInt(id);
  const db = getDb();

  // Verify ownership for teachers
  if (session.role === 'teacher') {
    const quiz = db.prepare('SELECT teacher_id FROM quizzes WHERE id = ?').get(quizId) as { teacher_id: number } | undefined;
    if (!quiz || quiz.teacher_id !== parseInt(session.sub)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const results = db.prepare(`
    SELECT a.id AS attempt_id, a.score, a.max_score, a.submitted_at,
           u.id AS student_id, u.name_en, u.name_ar, u.email,
           c.name AS class_name
    FROM attempts a
    JOIN users u ON a.student_id = u.id
    JOIN classes c ON u.class_id = c.id
    WHERE a.quiz_id = ? AND a.is_submitted = 1
    ORDER BY a.score DESC NULLS LAST
  `).all(quizId);

  const quiz = db.prepare(`
    SELECT q.id, q.title, q.negative_marking, q.penalty_fraction,
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
           (SELECT COUNT(*) FROM users WHERE class_id = q.class_id AND role = 'student') AS class_size
    FROM quizzes q WHERE q.id = ?
  `).get(quizId) as { id: number; title: string; negative_marking: number; penalty_fraction: number; question_count: number; class_size: number } | undefined;

  return NextResponse.json({ quiz, results });
}
