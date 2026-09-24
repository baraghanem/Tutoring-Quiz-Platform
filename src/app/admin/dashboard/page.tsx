import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface ClassStat {
  id: number;
  name: string;
  student_count: number;
  quiz_count: number;
  avg_percentage: number | null;
}

interface TopStudent {
  id: number;
  name_en: string;
  name_ar: string;
  class_name: string;
  quizzes_taken: number;
  avg_percentage: number;
}

interface RecentQuiz {
  id: number;
  title: string;
  class_name: string;
  teacher_name: string;
  opens_at: string;
  closes_at: string;
  submissions: number;
  avg_percentage: number | null;
}

interface MissedQuiz {
  student_id: number;
  name_en: string;
  name_ar: string;
  email: string;
  class_name: string;
  quiz_id: number;
  quiz_title: string;
  closes_at: string;
}

interface GlobalStats {
  total_students: number;
  total_teachers: number;
  total_quizzes: number;
  total_submissions: number;
}

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const db = getDb();
  const now = new Date().toISOString();

  const missedQuizzes = db.prepare(`
    SELECT u.id AS student_id, u.name_ar, u.name_en, u.email,
           c.name AS class_name,
           q.id AS quiz_id, q.title AS quiz_title, q.closes_at
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    JOIN users u ON u.class_id = c.id AND u.role = 'student'
    LEFT JOIN attempts a ON a.quiz_id = q.id AND a.student_id = u.id AND a.is_submitted = 1
    WHERE q.closes_at < ? AND a.id IS NULL
    ORDER BY q.closes_at DESC, c.name, u.name_en
  `).all(now) as MissedQuiz[];

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'student') AS total_students,
      (SELECT COUNT(*) FROM users WHERE role = 'teacher') AS total_teachers,
      (SELECT COUNT(*) FROM quizzes) AS total_quizzes,
      (SELECT COUNT(*) FROM attempts WHERE is_submitted = 1) AS total_submissions
  `).get() as GlobalStats;

  const classes = db.prepare(`
    SELECT c.id, c.name,
           COUNT(u.id) AS student_count,
           (SELECT COUNT(*) FROM quizzes WHERE class_id = c.id) AS quiz_count,
           (SELECT AVG(a.score * 100.0 / NULLIF(a.max_score, 0))
            FROM attempts a JOIN quizzes q ON a.quiz_id = q.id
            WHERE q.class_id = c.id AND a.is_submitted = 1) AS avg_percentage
    FROM classes c
    LEFT JOIN users u ON u.class_id = c.id AND u.role = 'student'
    GROUP BY c.id ORDER BY c.name
  `).all() as ClassStat[];

  const topStudents = db.prepare(`
    SELECT u.id, u.name_en, u.name_ar, c.name AS class_name,
           COUNT(a.id) AS quizzes_taken,
           AVG(a.score * 100.0 / NULLIF(a.max_score, 0)) AS avg_percentage
    FROM users u
    JOIN classes c ON u.class_id = c.id
    LEFT JOIN attempts a ON a.student_id = u.id AND a.is_submitted = 1
    WHERE u.role = 'student'
    GROUP BY u.id HAVING quizzes_taken > 0
    ORDER BY avg_percentage DESC LIMIT 10
  `).all() as TopStudent[];

  const recentQuizzes = db.prepare(`
    SELECT q.id, q.title, c.name AS class_name, u.name_en AS teacher_name,
           q.opens_at, q.closes_at,
           (SELECT COUNT(*) FROM attempts WHERE quiz_id = q.id AND is_submitted = 1) AS submissions,
           (SELECT AVG(a.score * 100.0 / NULLIF(a.max_score, 0))
            FROM attempts a WHERE a.quiz_id = q.id AND a.is_submitted = 1) AS avg_percentage
    FROM quizzes q
    JOIN classes c ON q.class_id = c.id
    JOIN users u ON q.teacher_id = u.id
    ORDER BY q.created_at DESC LIMIT 6
  `).all() as RecentQuiz[];

  return (
    <div className="page-wrapper">
      <Navbar nameEn={session.name_en} nameAr={session.name_ar} role="admin" />
      <main className="container">
        <div className="page-hero" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1>Admin Dashboard · لوحة الإدارة</h1>
            <p>Overview of Nour Tutoring Centre</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/teacher/quiz/create" className="btn btn-primary btn-sm">+ New Quiz</Link>
            <Link href="/teacher/dashboard" className="btn btn-ghost btn-sm">All Quizzes</Link>
          </div>
        </div>

        {/* Global stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_students}</div>
            <div className="stat-label">Students · طلاب</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_teachers}</div>
            <div className="stat-label">Teachers · معلمون</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_quizzes}</div>
            <div className="stat-label">Quizzes · اختبارات</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-accent)' }}>{stats.total_submissions}</div>
            <div className="stat-label">Submissions · تسليمات</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: missedQuizzes.length > 0 ? 'var(--color-warning)' : 'var(--color-text-2)' }}>
              {missedQuizzes.length}
            </div>
            <div className="stat-label">Missed · فائتة</div>
          </div>
        </div>

        {/* Classes */}
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-2)', margin: '1.5rem 0 0.75rem' }}>
          Classes · الفصول
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {classes.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--color-primary)' }}>{c.name}</span>
                {c.avg_percentage != null && (
                  <span className="badge badge-success">{Math.round(c.avg_percentage)}% avg</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-muted">👥 {c.student_count} students</span>
                <span className="badge badge-muted">📋 {c.quiz_count} quizzes</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          {/* Top students */}
          <div className="card">
            <div className="card-header"><strong>🏆 Top Students · أفضل الطلاب</strong></div>
            {topStudents.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}><p>No data yet</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topStudents.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', fontWeight: 800, color: i < 3 ? 'var(--color-warning)' : 'var(--color-text-3)' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div dir="rtl" style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name_ar}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-2)' }}>{s.class_name} · {s.quizzes_taken} quizzes</div>
                    </div>
                    <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>{Math.round(s.avg_percentage)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent quizzes */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>📋 Recent Quizzes</strong>
              <Link href="/teacher/dashboard" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>View all →</Link>
            </div>
            {recentQuizzes.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}><p>No quizzes yet</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentQuizzes.map((q) => (
                  <div key={q.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span dir="auto" style={{ fontWeight: 600, fontSize: '0.9rem' }}>{q.title}</span>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{q.class_name}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', marginTop: '0.2rem' }}>
                      {q.teacher_name} · {q.submissions} submissions
                      {q.avg_percentage != null ? ` · ${Math.round(q.avg_percentage)}% avg` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missed quizzes */}
          <div className="card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>⚠️ Missed Quizzes · اختبارات فائتة ({missedQuizzes.length})</strong>
              <Link href="/admin/reports#missed" style={{ fontSize: '0.8rem', color: 'var(--color-primary)' }}>Details →</Link>
            </div>
            {missedQuizzes.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 0' }}>
                <p style={{ color: 'var(--color-success)' }}>✓ All eligible students completed closed quizzes!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 280, overflowY: 'auto' }}>
                {missedQuizzes.slice(0, 8).map((m) => (
                  <div key={`${m.student_id}-${m.quiz_id}`} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div dir="rtl" style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.name_ar}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-2)' }}>{m.name_en} ({m.class_name})</div>
                      </div>
                      <span className="badge badge-warning" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Missed</span>
                    </div>
                    <div dir="auto" style={{ fontSize: '0.78rem', color: 'var(--color-text-2)', marginTop: '0.2rem' }}>
                      Quiz: {m.quiz_title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
          <Link href="/admin/reports" className="btn btn-ghost btn-sm" id="full-reports-link">
            Full Reports · التقارير الكاملة →
          </Link>
        </div>
      </main>
    </div>
  );
}
