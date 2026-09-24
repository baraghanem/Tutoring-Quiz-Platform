import { describe, it, expect } from 'vitest';
import { computeDeadline, isLateSubmission } from '@/lib/timing';

describe('computeDeadline', () => {
  it('calculates standard deadline from started_at and duration', () => {
    const start = new Date('2026-09-24T10:00:00.000Z');
    const deadline = computeDeadline(start, 20);
    expect(deadline.toISOString()).toBe('2026-09-24T10:20:00.000Z');
  });

  it('accepts string started_at timestamps', () => {
    const deadline = computeDeadline('2026-09-24T12:00:00.000Z', 15);
    expect(deadline.toISOString()).toBe('2026-09-24T12:15:00.000Z');
  });

  it('does not clamp if closes_at is after the full duration', () => {
    const start = new Date('2026-09-24T10:00:00.000Z');
    const closesAt = new Date('2026-09-24T11:00:00.000Z');
    const deadline = computeDeadline(start, 20, closesAt);
    expect(deadline.toISOString()).toBe('2026-09-24T10:20:00.000Z');
  });

  it('clamps deadline to closes_at if quiz window closes before timer expires', () => {
    const start = new Date('2026-09-24T10:15:00.000Z');
    const closesAt = new Date('2026-09-24T10:20:00.000Z'); // only 5 min left
    const deadline = computeDeadline(start, 20, closesAt);
    expect(deadline.toISOString()).toBe('2026-09-24T10:20:00.000Z');
  });

  it('handles null or undefined closes_at gracefully', () => {
    const start = new Date('2026-09-24T10:00:00.000Z');
    const deadline = computeDeadline(start, 30, null);
    expect(deadline.toISOString()).toBe('2026-09-24T10:30:00.000Z');
  });
});

describe('isLateSubmission', () => {
  const deadline = new Date('2026-09-24T10:20:00.000Z');

  it('returns false when submitted before deadline', () => {
    const submittedAt = new Date('2026-09-24T10:18:30.000Z');
    expect(isLateSubmission(submittedAt, deadline)).toBe(false);
  });

  it('returns false when submitted exactly at deadline', () => {
    const submittedAt = new Date('2026-09-24T10:20:00.000Z');
    expect(isLateSubmission(submittedAt, deadline)).toBe(false);
  });

  it('returns false when within the default 30-second network grace period', () => {
    const submittedAt = new Date('2026-09-24T10:20:25.000Z'); // 25s late
    expect(isLateSubmission(submittedAt, deadline, 30)).toBe(false);
  });

  it('returns true when submitted after deadline and grace period', () => {
    const submittedAt = new Date('2026-09-24T10:20:31.000Z'); // 31s late
    expect(isLateSubmission(submittedAt, deadline, 30)).toBe(true);
  });

  it('respects custom grace period', () => {
    const submittedAt = new Date('2026-09-24T10:20:15.000Z');
    expect(isLateSubmission(submittedAt, deadline, 10)).toBe(true);
    expect(isLateSubmission(submittedAt, deadline, 20)).toBe(false);
  });
});
