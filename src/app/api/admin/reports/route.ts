import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();

  const classes = db.prepare(`
    SELECT c.id, c.name,
           COUNT(u.id) AS student_count,
           (SELECT COUNT(*) FROM quizzes WHERE class_id = c.id) AS quiz_count,
           (SELECT AVG(a.score * 100.0 / NULLIF(a.max_score, 0))
            FROM attempts a JOIN quizzes q ON a.quiz_id = q.id
            WHERE q.class_id = c.id AND a.is_submitted = 1) AS avg_percentage
    FROM classes c
    LEFT JOIN users u ON u.class_id = c.id AND u.role = 'student'
    GROUP BY c.id
    ORDER BY c.name
  `).all();

  const topStudents = db.prepare(`
    SELECT u.id, u.name_en, u.name_ar, c.name AS class_name,
           COUNT(a.id) AS quizzes_taken,
           AVG(a.score * 100.0 / NULLIF(a.max_score, 0)) AS avg_percentage
    FROM users u
    JOIN classes c ON u.class_id = c.id
    LEFT JOIN attempts a ON a.student_id = u.id AND a.is_submitted = 1
    WHERE u.role = 'student'
    GROUP BY u.id
    HAVING quizzes_taken > 0
    ORDER BY avg_percentage DESC
    LIMIT 10
  `).all();

  const recentQuizzes = db.prepare(`
    SELECT q.id, q.title, c.name AS class_name, u.name_en AS teacher_name,
           q.opens_at, q.closes_at,
           (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submissions,
           (SELECT AVG(a.score * 100.0 / NULLIF(a.max_score, 0))
            FROM attempts a WHERE a.quiz_id = q.id AND a.is_submitted = 1) AS avg_percentage
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    JOIN users u ON q.teacher_id = u.id
    ORDER BY q.created_at DESC
    LIMIT 10
  `).all();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
      (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
      (SELECT COUNT(*) FROM attempts WHERE is_submitted = 1) AS total_submissions
  `).get();

  return NextResponse.json({ classes, topStudents, recentQuizzes, stats });
}
