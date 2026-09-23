import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  let quizzes;

  if (session.role === 'admin') {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.opens_at, q.closes_at, q.time_limit_minutes,
             q.negative_marking, q.penalty_fraction,
             c.name AS class_name, u.name_en AS teacher_name_en,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submission_count
      FROM quizzes q
      JOIN classes c ON q.class_id = c.id
      JOIN users u ON q.teacher_id = u.id
      ORDER BY q.created_at DESC
    `).all();
  } else {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.opens_at, q.closes_at, q.time_limit_minutes,
             q.negative_marking, q.penalty_fraction,
             c.name AS class_name,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submission_count
      FROM quizzes q
      JOIN classes c ON q.class_id = c.id
      WHERE q.teacher_id = ?
      ORDER BY q.created_at DESC
    `).all(parseInt(session.sub));
  }

  return NextResponse.json({ quizzes });
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const body = await req.json();
  const {
    title, description, class_id, time_limit_minutes,
    opens_at, closes_at, negative_marking, penalty_fraction,
    questions,
  } = body;

  // Validation
  if (!title || !class_id || !opens_at || !closes_at || !questions?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  if (new Date(opens_at) >= new Date(closes_at)) {
    return NextResponse.json({ error: 'opens_at must be before closes_at' }, { status: 400 });
  }
  if (!questions.every((q: { options?: unknown[] }) => q.options?.length === 4)) {
    return NextResponse.json({ error: 'Each question must have exactly 4 options' }, { status: 400 });
  }

  const teacherId = session.role === 'teacher' ? parseInt(session.sub) : (body.teacher_id || parseInt(session.sub));

  const createTx = db.transaction(() => {
    const quizResult = db.prepare(`
      INSERT INTO quizzes (title, description, teacher_id, class_id, time_limit_minutes,
                           opens_at, closes_at, negative_marking, penalty_fraction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, teacherId, class_id,
      time_limit_minutes || 20, opens_at, closes_at,
      negative_marking ? 1 : 0, penalty_fraction || 0.25
    );

    const quizId = quizResult.lastInsertRowid;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qResult = db.prepare(`
        INSERT INTO questions (quiz_id, body, points, order_index) VALUES (?, ?, ?, ?)
      `).run(quizId, q.body, q.points || 1, i);

      const questionId = qResult.lastInsertRowid;
      for (const opt of q.options) {
        db.prepare(`
          INSERT INTO options (question_id, body, is_correct) VALUES (?, ?, ?)
        `).run(questionId, opt.body, opt.is_correct ? 1 : 0);
      }
    }

    return quizId;
  });

  const quizId = createTx();
  return NextResponse.json({ ok: true, quiz_id: quizId }, { status: 201 });
}
