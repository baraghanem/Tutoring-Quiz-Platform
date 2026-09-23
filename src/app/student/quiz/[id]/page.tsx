'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface Option {
  id: number;
  body: string;
}

interface Question {
  id: number;
  body: string;
  points: number;
  order_index: number;
  options: Option[];
}

interface QuizData {
  attempt_id: number;
  started_at: string;
  deadline: string;
  questions: Question[];
  resumed: boolean;
}

export default function QuizPage() {
  const params = useParams();
  const quizId = params.id as string;
  const router = useRouter();

  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const submittedRef = useRef(false);

  // Start or resume attempt
  useEffect(() => {
    fetch(`/api/student/quiz/${quizId}/start`, { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }
        setQuizData(data);
        const deadline = new Date(data.deadline).getTime();
        const remaining = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
        setTimeLeft(remaining);
        setLoading(false);
      })
      .catch(() => { setError('Failed to load quiz.'); setLoading(false); });
  }, [quizId]);

  const submitQuiz = useCallback(async (currentAnswers: Record<number, number | null>, aid: number) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/student/quiz/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt_id: aid, answers: currentAnswers }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(
          `/student/results?score=${data.score}&max=${data.max_score}&pct=${data.percentage}&correct=${data.correct_count}&wrong=${data.wrong_count}&unanswered=${data.unanswered_count}`
        );
      } else {
        setError(data.error || 'Submission failed');
        setSubmitting(false);
        submittedRef.current = false;
      }
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
      submittedRef.current = false;
    }
  }, [quizId, router]);

  // Countdown timer
  useEffect(() => {
    if (!quizData || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          // Auto-submit
          submitQuiz(answers, quizData.attempt_id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [quizData, submitQuiz]); // eslint-disable-line react-hooks/exhaustive-deps

  function formatTime(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function selectOption(questionId: number, optionId: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  if (loading) return (
    <div className="loading-center" style={{ minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
        <p className="alert alert-error">{error}</p>
        <a href="/student/dashboard" className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );

  if (!quizData) return null;

  const { questions, attempt_id } = quizData;
  const q = questions[currentQ];
  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;
  const timerClass = timeLeft < 60 ? 'danger' : timeLeft < 300 ? 'warning' : '';
  const progress = Math.round((answeredCount / questions.length) * 100);

  return (
    <div className="page-wrapper" style={{ maxWidth: '100vw' }}>
      {/* Sticky quiz header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0.75rem 1rem',
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <div className="progress-bar" style={{ flex: 1, maxWidth: 200 }}>
              <div className="progress-bar__fill" style={{ width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
              {answeredCount}/{questions.length}
            </span>
          </div>
          <div className={`timer ${timerClass}`} id="quiz-timer">
            ⏱ {formatTime(timeLeft)}
          </div>
        </div>
      </div>

      <main className="container" style={{ paddingTop: '1.5rem', paddingBottom: '6rem' }}>
        {/* Question nav */}
        <div className="question-nav" id="question-nav">
          {questions.map((_, i) => (
            <button
              key={i}
              id={`nav-dot-${i}`}
              className={`question-dot ${answers[questions[i].id] !== undefined ? 'answered' : ''} ${i === currentQ ? 'current' : ''}`}
              onClick={() => setCurrentQ(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Question card */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="badge badge-primary">Q{currentQ + 1} of {questions.length}</span>
            <span className="badge badge-muted">{q.points} {q.points === 1 ? 'point' : 'points'}</span>
          </div>
          <div dir="auto" style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '1.25rem', lineHeight: 1.5 }}>
            {q.body}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {q.options.map((opt) => (
              <button
                key={opt.id}
                id={`option-${opt.id}`}
                className={`option-btn ${answers[q.id] === opt.id ? 'selected' : ''}`}
                onClick={() => selectOption(q.id, opt.id)}
                dir="auto"
              >
                {opt.body}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.5rem' }}>
          <button
            id="prev-btn"
            className="btn btn-ghost"
            onClick={() => setCurrentQ((c) => Math.max(0, c - 1))}
            disabled={currentQ === 0}
          >
            ← Previous
          </button>
          {currentQ < questions.length - 1 ? (
            <button
              id="next-btn"
              className="btn btn-primary"
              onClick={() => setCurrentQ((c) => Math.min(questions.length - 1, c + 1))}
            >
              Next →
            </button>
          ) : (
            <button
              id="submit-quiz-btn"
              className="btn btn-accent"
              onClick={() => {
                if (confirm(`Submit quiz? You have answered ${answeredCount} of ${questions.length} questions.`)) {
                  submitQuiz(answers, attempt_id);
                }
              }}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : '✓ Submit Quiz · تسليم'}
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
