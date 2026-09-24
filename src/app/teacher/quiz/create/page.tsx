'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface Option { body: string; is_correct: boolean; }
interface Question { body: string; points: number; options: Option[]; }
interface Class { id: number; name: string; }

function emptyQuestion(): Question {
  return {
    body: '',
    points: 1,
    options: [
      { body: '', is_correct: true },
      { body: '', is_correct: false },
      { body: '', is_correct: false },
      { body: '', is_correct: false },
    ],
  };
}

export default function CreateQuizPage() {
  const router = useRouter();

  const [classes, setClasses] = useState<Class[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(20);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [penaltyFraction, setPenaltyFraction] = useState(0.25);
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Get classes
    fetch('/api/teacher/quizzes')
      .then((r) => r.json())
      .catch(() => {});
    // Fetch classes list from a dedicated endpoint (we'll use a simple approach)
    fetch('/api/classes')
      .then((r) => r.json())
      .then((d) => { if (d.classes) setClasses(d.classes); })
      .catch(() => {});
    // Set defaults for opens/closes
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const close = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    setOpensAt(now.toISOString().slice(0, 16));
    setClosesAt(close.toISOString().slice(0, 16));
  }, []);

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQuestion(idx: number, field: keyof Question, value: string | number) {
    setQuestions((prev) => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  }

  function updateOption(qIdx: number, oIdx: number, field: keyof Option, value: string | boolean) {
    setQuestions((prev) => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = q.options.map((o, j): Option => {
        if (field === 'is_correct') {
          return { ...o, is_correct: j === oIdx };
        }
        if (field === 'body' && typeof value === 'string') {
          return { ...o, body: value };
        }
        return o;
      });
      return { ...q, options: opts };
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Validate
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.body.trim()) { setError(`Question ${i + 1} has no text`); return; }
      if (!q.options.every((o) => o.body.trim())) { setError(`Question ${i + 1}: all 4 options must have text`); return; }
      if (!q.options.some((o) => o.is_correct)) { setError(`Question ${i + 1}: mark one option as correct`); return; }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/teacher/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, class_id: parseInt(classId),
          time_limit_minutes: timeLimitMinutes,
          opens_at: new Date(opensAt).toISOString(),
          closes_at: new Date(closesAt).toISOString(),
          negative_marking: negativeMarking,
          penalty_fraction: penaltyFraction,
          questions,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create quiz'); return; }
      router.push('/teacher/dashboard');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-wrapper">
      <Navbar nameEn="Teacher" nameAr="معلم" role="teacher" />
      <main className="container" style={{ paddingBottom: '4rem' }}>
        <div className="page-hero">
          <h1>Create New Quiz · إنشاء اختبار جديد</h1>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} id="create-quiz-form">
          {/* Quiz settings */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className="card-header">
              <strong>Quiz Settings · إعدادات الاختبار</strong>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="quiz-title">Title · العنوان *</label>
                <input id="quiz-title" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. اختبار الرياضيات – الجبر" dir="auto" />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="quiz-desc">Description · الوصف</label>
                <textarea id="quiz-desc" className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} dir="auto" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-class">Class · الفصل *</label>
                  <select id="quiz-class" className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                    <option value="">Select class...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-time">Time Limit (minutes)</label>
                  <input id="quiz-time" type="number" className="form-input" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value))} min={1} max={180} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-opens">Opens At · وقت الفتح</label>
                  <input id="quiz-opens" type="datetime-local" className="form-input" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="quiz-closes">Closes At · وقت الإغلاق</label>
                  <input id="quiz-closes" type="datetime-local" className="form-input" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required />
                </div>
              </div>
              {/* Negative marking */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    id="negative-marking-toggle"
                    type="checkbox"
                    checked={negativeMarking}
                    onChange={(e) => setNegativeMarking(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                  />
                  <span style={{ fontWeight: 600 }}>Negative Marking · خصم للإجابات الخاطئة</span>
                </label>
                {negativeMarking && (
                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                    <label className="form-label" htmlFor="penalty-fraction" style={{ whiteSpace: 'nowrap' }}>Penalty fraction:</label>
                    <select id="penalty-fraction" className="form-select" style={{ width: 'auto' }} value={penaltyFraction} onChange={(e) => setPenaltyFraction(parseFloat(e.target.value))}>
                      <option value={0.25}>¼ (0.25)</option>
                      <option value={0.33}>⅓ (0.33)</option>
                      <option value={0.5}>½ (0.5)</option>
                      <option value={1}>1× (full)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Questions */}
          {questions.map((q, qIdx) => (
            <div key={qIdx} className="card" style={{ marginBottom: '1rem' }} id={`question-${qIdx}`}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Question {qIdx + 1} · السؤال {qIdx + 1}</strong>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-text-2)' }}>Points:</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ width: 70 }}
                    value={q.points}
                    onChange={(e) => updateQuestion(qIdx, 'points', parseFloat(e.target.value))}
                    min={0.5} step={0.5}
                  />
                  {questions.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeQuestion(qIdx)}>✕</button>
                  )}
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <textarea
                  id={`q-body-${qIdx}`}
                  className="form-textarea"
                  placeholder="Question text · نص السؤال"
                  value={q.body}
                  onChange={(e) => updateQuestion(qIdx, 'body', e.target.value)}
                  dir="auto"
                  required
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="radio"
                      name={`correct-${qIdx}`}
                      id={`opt-correct-${qIdx}-${oIdx}`}
                      checked={opt.is_correct}
                      onChange={() => updateOption(qIdx, oIdx, 'is_correct', true)}
                      style={{ accentColor: 'var(--color-success)', width: 18, height: 18, flexShrink: 0 }}
                      title="Mark as correct answer"
                    />
                    <input
                      id={`opt-body-${qIdx}-${oIdx}`}
                      className="form-input"
                      placeholder={`Option ${oIdx + 1}`}
                      value={opt.body}
                      onChange={(e) => updateOption(qIdx, oIdx, 'body', e.target.value)}
                      dir="auto"
                      required
                    />
                    {opt.is_correct && <span className="badge badge-success" style={{ flexShrink: 0 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" id="add-question-btn" className="btn btn-ghost" onClick={addQuestion}>
              + Add Question · إضافة سؤال
            </button>
            <button type="submit" id="save-quiz-btn" className="btn btn-accent" disabled={submitting}>
              {submitting ? 'Saving...' : '✓ Save Quiz · حفظ الاختبار'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
