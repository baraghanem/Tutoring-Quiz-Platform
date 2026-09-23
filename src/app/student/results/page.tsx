'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResultContent() {
  const sp = useSearchParams();
  const score = sp.get('score') || '0';
  const max = sp.get('max') || '0';
  const pct = parseInt(sp.get('pct') || '0');
  const correct = sp.get('correct') || '0';
  const wrong = sp.get('wrong') || '0';
  const unanswered = sp.get('unanswered') || '0';

  const grade = pct >= 90 ? { label: 'ممتاز · Excellent', color: 'var(--color-accent)' }
    : pct >= 75 ? { label: 'جيد جداً · Very Good', color: 'var(--color-success)' }
    : pct >= 60 ? { label: 'جيد · Good', color: 'var(--color-primary)' }
    : pct >= 50 ? { label: 'مقبول · Pass', color: 'var(--color-warning)' }
    : { label: 'ضعيف · Below Pass', color: 'var(--color-danger)' };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${grade.color}22, transparent 70%), var(--color-bg)`,
      padding: '1rem',
    }}>
      <div className="card" style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          {pct >= 60 ? '🎉' : '💪'}
        </div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          {pct >= 60 ? 'Quiz Complete!' : 'Quiz Submitted!'}
        </h1>
        <p style={{ color: 'var(--color-text-2)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          تم تسليم الاختبار بنجاح
        </p>

        {/* Score circle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="score-circle" style={{ borderColor: grade.color, boxShadow: `0 0 40px ${grade.color}40` }}>
            <span className="score-pct" style={{ color: grade.color }}>{pct}%</span>
            <span className="score-label">{score} / {max} pts</span>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <span className="badge" style={{ background: `${grade.color}22`, color: grade.color, fontSize: '0.9rem', padding: '0.35rem 1rem' }}>
            {grade.label}
          </span>
        </div>

        {/* Breakdown */}
        <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-success)' }}>{correct}</div>
            <div className="stat-label">Correct · صح</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-danger)' }}>{wrong}</div>
            <div className="stat-label">Wrong · خطأ</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-text-3)' }}>{unanswered}</div>
            <div className="stat-label">Skipped · متروك</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/student/dashboard" className="btn btn-primary btn-sm" id="back-to-dashboard">
            ← Dashboard · الرئيسية
          </Link>
          <Link href="/student/results" className="btn btn-ghost btn-sm">
            All Results · كل النتائج
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="loading-center" style={{ minHeight: '100dvh' }}><div className="spinner" /></div>}>
      <ResultContent />
    </Suspense>
  );
}
