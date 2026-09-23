import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'student' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const studentId = parseInt(session.sub);

  const results = db.prepare(`
    SELECT a.id, a.quiz_id, a.started_at, a.submitted_at, a.score, a.max_score,
           q.title, q.negative_marking, q.penalty_fraction,
           c.name AS class_name,
           u.name_en AS teacher_name_en
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    JOIN classes c ON q.class_id = c.id
    JOIN users u ON q.teacher_id = u.id
    WHERE a.student_id = ? AND a.is_submitted = 1
    ORDER BY a.submitted_at DESC
  `).all(studentId);

  return NextResponse.json({ results });
}
