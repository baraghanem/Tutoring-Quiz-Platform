import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Quiz {
  id: number;
  title: string;
  description: string;
  time_limit_minutes: number;
  opens_at: string;
  closes_at: string;
  negative_marking: number;
  question_count: number;
  class_name: string;
  teacher_name_en: string;
  attempt_submitted_at: string | null;
  attempt_score: number | null;
  attempt_max_score: number | null;
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('ar-JO', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session || (session.role !== 'student' && session.role !== 'admin')) {
    redirect('/login');
  }

  const db = getDb();
  const now = new Date().toISOString();

  const quizzes = db.prepare(`
    SELECT q.id, q.title, q.description, q.time_limit_minutes,
           q.opens_at, q.closes_at, q.negative_marking,
           c.name AS class_name, u.name_en AS teacher_name_en,
           (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count,
           a.submitted_at AS attempt_submitted_at,
           a.score AS attempt_score,
           a.max_score AS attempt_max_score
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    JOIN users u ON q.teacher_id = u.id
    LEFT JOIN attempts a ON a.quiz_id = q.id AND a.student_id = ?
    WHERE q.class_id = (SELECT class_id FROM users WHERE id = ?)
      AND q.opens_at <= ? AND q.closes_at >= ?
    ORDER BY q.closes_at ASC
  `).all(session.sub, session.sub, now, now) as Quiz[];

  const available = quizzes.filter((q) => !q.attempt_submitted_at);
  const completed = quizzes.filter((q) => q.attempt_submitted_at);

  return (
    <div className="page-wrapper">
      <Navbar nameEn={session.name_en} nameAr={session.name_ar} role={session.role} />
      <main className="container">
        <div className="page-hero">
          <h1>مرحباً، {session.name_ar} 👋</h1>
          <p>Available quizzes for your class · الاختبارات المتاحة لصفك</p>
        </div>

        {available.length === 0 && completed.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No quizzes available right now · لا توجد اختبارات متاحة الآن</p>
          </div>
        )}

        {available.length > 0 && (
          <>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: '0.75rem' }}>
              Available · متاح ({available.length})
            </h2>
            <div className="quiz-grid">
              {available.map((quiz) => (
                <div key={quiz.id} className="quiz-card">
                  <div className="quiz-card__meta">
                    <span className="badge badge-primary">{quiz.class_name}</span>
                    {quiz.negative_marking ? (
                      <span className="badge badge-warning">⚠ Negative Marking</span>
                    ) : null}
                    <span className="badge badge-muted">⏱ {quiz.time_limit_minutes} min</span>
                    <span className="badge badge-muted">❓ {quiz.question_count} Qs</span>
                  </div>
                  <div className="quiz-card__title" dir="auto">{quiz.title}</div>
                  {quiz.description && (
                    <div className="quiz-card__desc" dir="auto">{quiz.description}</div>
                  )}
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>
                    Closes: {formatDate(quiz.closes_at)}
                  </div>
                  <Link
                    id={`start-quiz-${quiz.id}`}
                    href={`/student/quiz/${quiz.id}`}
                    className="btn btn-primary btn-sm"
                    style={{ alignSelf: 'flex-start', marginTop: 'auto' }}
                  >
                    ابدأ الاختبار · Start Quiz
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {completed.length > 0 && (
          <>
            <div className="divider" style={{ margin: '2rem 0 1.25rem' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-2)', marginBottom: '0.75rem' }}>
              Completed · مكتمل ({completed.length})
            </h2>
            <div className="quiz-grid">
              {completed.map((quiz) => {
                const pct = quiz.attempt_max_score
                  ? Math.round((quiz.attempt_score! / quiz.attempt_max_score) * 100)
                  : 0;
                return (
                  <div key={quiz.id} className="quiz-card" style={{ opacity: 0.75 }}>
                    <div className="quiz-card__meta">
                      <span className="badge badge-success">✓ Done</span>
                      <span className="badge badge-muted">{quiz.class_name}</span>
                    </div>
                    <div className="quiz-card__title" dir="auto">{quiz.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-accent)' }}>{pct}%</span>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-2)' }}>
                        {quiz.attempt_score} / {quiz.attempt_max_score} pts
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-3)' }}>
                      Submitted: {formatDate(quiz.attempt_submitted_at!)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginTop: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <Link href="/student/results" className="btn btn-ghost btn-sm">
            View all results · عرض كل النتائج →
          </Link>
        </div>
      </main>
    </div>
  );
}
