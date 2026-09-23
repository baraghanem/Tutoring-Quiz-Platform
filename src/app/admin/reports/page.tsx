import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface StudentResult {
  student_id: number;
  name_ar: string;
  name_en: string;
  class_name: string;
  quizzes_taken: number;
  avg_percentage: number | null;
  total_score: number;
  total_max: number;
}

export default async function AdminReports() {
  const session = await getSession();
  if (!session || session.role !== 'admin') redirect('/login');

  const db = getDb();

  const students = db.prepare(`
    SELECT u.id AS student_id, u.name_ar, u.name_en, c.name AS class_name,
           COUNT(a.id) AS quizzes_taken,
           ROUND(AVG(a.score * 100.0 / NULLIF(a.max_score, 0)), 1) AS avg_percentage,
           COALESCE(SUM(a.score), 0) AS total_score,
           COALESCE(SUM(a.max_score), 0) AS total_max
    FROM users u
    JOIN classes c ON u.class_id = c.id
    LEFT JOIN attempts a ON a.student_id = u.id AND a.is_submitted = 1
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY c.name, avg_percentage DESC NULLS LAST
  `).all() as StudentResult[];

  // Group by class
  const byClass: Record<string, StudentResult[]> = {};
  for (const s of students) {
    if (!byClass[s.class_name]) byClass[s.class_name] = [];
    byClass[s.class_name].push(s);
  }

  return (
    <div className="page-wrapper">
      <Navbar nameEn={session.name_en} nameAr={session.name_ar} role="admin" />
      <main className="container" style={{ paddingBottom: '3rem' }}>
        <div className="page-hero">
          <Link href="/admin/dashboard" style={{ fontSize: '0.85rem', color: 'var(--color-text-2)', marginBottom: '0.5rem', display: 'inline-block' }}>← Dashboard</Link>
          <h1>Full Reports · التقارير الكاملة</h1>
          <p>All student results across every class · جميع نتائج الطلاب</p>
        </div>

        {Object.entries(byClass).map(([className, classStudents]) => {
          const taken = classStudents.filter((s) => s.quizzes_taken > 0);
          const classAvg = taken.length
            ? Math.round(taken.reduce((s, st) => s + (st.avg_percentage ?? 0), 0) / taken.length)
            : null;

          return (
            <div key={className} style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Class {className}</h2>
                {classAvg != null && (
                  <span className="badge badge-success">Class avg: {classAvg}%</span>
                )}
                <span className="badge badge-muted">{classStudents.length} students</span>
              </div>
              <div className="table-wrapper card" style={{ padding: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student</th>
                      <th>Quizzes Taken</th>
                      <th>Total Score</th>
                      <th>Average %</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classStudents.map((s, i) => {
                      const pct = s.avg_percentage;
                      const grade = pct == null ? '–'
                        : pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 50 ? 'D' : 'F';
                      const gradeClass = grade === 'A' || grade === 'B' ? 'badge-success'
                        : grade === 'C' ? 'badge-primary'
                        : grade === 'D' ? 'badge-warning'
                        : grade === 'F' ? 'badge-danger'
                        : 'badge-muted';
                      return (
                        <tr key={s.student_id}>
                          <td style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>{i + 1}</td>
                          <td>
                            <div dir="rtl" style={{ fontWeight: 600 }}>{s.name_ar}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-2)' }}>{s.name_en}</div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{s.quizzes_taken}</td>
                          <td>
                            {s.quizzes_taken > 0 ? `${s.total_score} / ${s.total_max}` : '–'}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {pct != null ? `${pct}%` : <span style={{ color: 'var(--color-text-3)' }}>Not taken</span>}
                          </td>
                          <td>
                            <span className={`badge ${gradeClass}`}>{grade}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
