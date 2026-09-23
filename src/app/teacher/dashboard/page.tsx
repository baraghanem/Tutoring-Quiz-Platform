import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Quiz {
  id: number;
  title: string;
  opens_at: string;
  closes_at: string;
  time_limit_minutes: number;
  negative_marking: number;
  class_name: string;
  question_count: number;
  submission_count: number;
  teacher_name_en?: string;
}

function statusBadge(opens: string, closes: string) {
  const now = new Date();
  const o = new Date(opens);
  const c = new Date(closes);
  if (now < o) return <span className="badge badge-warning">⏳ Upcoming</span>;
  if (now > c) return <span className="badge badge-muted">✓ Closed</span>;
  return <span className="badge badge-success">● Live</span>;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default async function TeacherDashboard() {
  const session = await getSession();
  if (!session || (session.role !== 'teacher' && session.role !== 'admin')) redirect('/login');

  const db = getDb();
  let quizzes: Quiz[];

  if (session.role === 'admin') {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.opens_at, q.closes_at, q.time_limit_minutes, q.negative_marking,
             c.name AS class_name, u.name_en AS teacher_name_en,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submission_count
      FROM quizzes q JOIN classes c ON q.class_id = c.id JOIN users u ON q.teacher_id = u.id
      ORDER BY q.created_at DESC
    `).all() as Quiz[];
  } else {
    quizzes = db.prepare(`
      SELECT q.id, q.title, q.opens_at, q.closes_at, q.time_limit_minutes, q.negative_marking,
             c.name AS class_name,
             (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
             (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submission_count
      FROM quizzes q JOIN classes c ON q.class_id = c.id
      WHERE q.teacher_id = ?
      ORDER BY q.created_at DESC
    `).all(parseInt(session.sub)) as Quiz[];
  }

  return (
    <div className="page-wrapper">
      <Navbar nameEn={session.name_en} nameAr={session.name_ar} role={session.role} />
      <main className="container">
        <div className="page-hero" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>My Quizzes · اختباراتي</h1>
            <p>Create and manage your quizzes</p>
          </div>
          <Link href="/teacher/quiz/create" id="create-quiz-btn" className="btn btn-primary">
            + New Quiz · اختبار جديد
          </Link>
        </div>

        {quizzes.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p>No quizzes yet. Create your first quiz!</p>
            <Link href="/teacher/quiz/create" className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
              Create Quiz
            </Link>
          </div>
        )}

        {quizzes.length > 0 && (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Quiz · الاختبار</th>
                  <th>Class · الفصل</th>
                  <th>Status</th>
                  <th>Opens</th>
                  <th>Closes</th>
                  <th>Qs</th>
                  <th>Submissions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <div dir="auto" style={{ fontWeight: 600 }}>{q.title}</div>
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
                        {q.negative_marking ? <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>⚠ Neg</span> : null}
                        <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>⏱{q.time_limit_minutes}m</span>
                        {q.teacher_name_en && <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>{q.teacher_name_en}</span>}
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{q.class_name}</span></td>
                    <td>{statusBadge(q.opens_at, q.closes_at)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{fmt(q.opens_at)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{fmt(q.closes_at)}</td>
                    <td style={{ fontWeight: 700 }}>{q.question_count}</td>
                    <td style={{ fontWeight: 700 }}>{q.submission_count}</td>
                    <td>
                      <Link
                        href={`/teacher/quiz/${q.id}/results`}
                        id={`view-results-${q.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Results →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
