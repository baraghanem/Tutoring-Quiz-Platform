import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Result {
  attempt_id: number;
  score: number;
  max_score: number;
  submitted_at: string;
  student_id: number;
  name_en: string;
  name_ar: string;
  email: string;
  class_name: string;
}

interface QuizInfo {
  id: number;
  title: string;
  negative_marking: number;
  penalty_fraction: number;
  question_count: number;
  class_size: number;
}

export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) redirect('/login');

  const { id } = await params;
  const quizId = parseInt(id);
  const db = getDb();

  // Verify ownership
  if (session.role === 'teacher') {
    const quiz = db.prepare('SELECT teacher_id FROM quizzes WHERE id = ?').get(quizId) as { teacher_id: number } | undefined;
    if (!quiz || quiz.teacher_id !== parseInt(session.sub)) redirect('/teacher/dashboard');
  }

  const quiz = db.prepare(`
    SELECT q.id, q.title, q.negative_marking, q.penalty_fraction,
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
           (SELECT COUNT(*) FROM users WHERE class_id = q.class_id AND role = 'student') AS class_size
    FROM quizzes q WHERE q.id = ?
  `).get(quizId) as QuizInfo | undefined;

  if (!quiz) redirect('/teacher/dashboard');

  const results = db.prepare(`
    SELECT a.id AS attempt_id, a.score, a.max_score, a.submitted_at,
           u.id AS student_id, u.name_en, u.name_ar, u.email,
           c.name AS class_name
    FROM attempts a
    JOIN users u ON a.student_id = u.id
    JOIN classes c ON u.class_id = c.id
    WHERE a.quiz_id = ? AND a.is_submitted = 1
    ORDER BY a.score DESC
  `).all(quizId) as Result[];

  const avgPct = results.length
    ? Math.round(results.reduce((s, r) => s + (r.score / (r.max_score || 1)) * 100, 0) / results.length)
    : 0;

  const participated = results.length;
  const notTaken = quiz.class_size - participated;

  return (
    <div className="page-wrapper">
      <Navbar nameEn={session.name_en} nameAr={session.name_ar} role={session.role} />
      <main className="container">
        <div className="page-hero">
          <Link href="/teacher/dashboard" style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '0.5rem', display: 'inline-block' }}>
            ← Back to Quizzes
          </Link>
          <h1 dir="auto">{quiz.title}</h1>
          <p>{quiz.question_count} questions · {quiz.negative_marking ? '⚠ Negative marking active' : 'No negative marking'}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{participated}</div>
            <div className="stat-label">Submitted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{notTaken}</div>
            <div className="stat-label">Not Taken</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-accent)' }}>{avgPct}%</div>
            <div className="stat-label">Class Average</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{quiz.class_size}</div>
            <div className="stat-label">Class Size</div>
          </div>
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No submissions yet</p>
          </div>
        ) : (
          <div className="table-wrapper card" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student · الطالب</th>
                  <th>Class</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Grade</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const pct = r.max_score ? Math.round((r.score / r.max_score) * 100) : 0;
                  const grade = pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
                  const gradeClass = grade === 'A' || grade === 'B' ? 'badge-success' : grade === 'C' ? 'badge-primary' : grade === 'D' ? 'badge-warning' : 'badge-danger';
                  return (
                    <tr key={r.attempt_id}>
                      <td style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>{i + 1}</td>
                      <td>
                        <div dir="rtl" style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.name_ar}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>{r.name_en}</div>
                      </td>
                      <td><span className="badge badge-primary">{r.class_name}</span></td>
                      <td style={{ fontWeight: 700 }}>{r.score} / {r.max_score}</td>
                      <td style={{ fontWeight: 700 }}>{pct}%</td>
                      <td><span className={`badge ${gradeClass}`}>{grade}</span></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>
                        {new Date(r.submitted_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
