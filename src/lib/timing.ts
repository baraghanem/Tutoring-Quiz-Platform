/**
 * Timing utilities for quiz platform.
 * Ensures server-side enforcement of quiz availability windows,
 * per-attempt duration limits, clamping against quiz close times,
 * and detection of late submissions with network latency buffers.
 */

/**
 * Computes the effective deadline for a quiz attempt.
 * If the quiz availability window closes before the allotted duration expires,
 * the deadline is clamped to the quiz's `closes_at` timestamp.
 *
 * @param startedAt When the attempt was started
 * @param timeLimitMinutes Quiz allotted duration in minutes
 * @param closesAt Optional ISO date string or Date when the quiz window closes
 * @returns Date object representing the effective deadline
 */
export function computeDeadline(
  startedAt: Date | string,
  timeLimitMinutes: number,
  closesAt?: Date | string | null
): Date {
  const start = new Date(startedAt);
  const durationMs = Math.max(1, timeLimitMinutes) * 60 * 1000;
  const standardDeadline = new Date(start.getTime() + durationMs);

  if (!closesAt) {
    return standardDeadline;
  }

  const windowClose = new Date(closesAt);
  if (!isNaN(windowClose.getTime()) && windowClose.getTime() < standardDeadline.getTime()) {
    return windowClose;
  }

  return standardDeadline;
}

/**
 * Determines whether a quiz submission arrived after the allowed deadline
 * plus a network grace period (defaults to 30 seconds).
 *
 * @param submittedAt Timestamp when submission arrived at the server
 * @param deadline Effective deadline of the attempt
 * @param gracePeriodSeconds Tolerance in seconds for network transit delay (default 30)
 * @returns boolean true if the submission is late
 */
export function isLateSubmission(
  submittedAt: Date | string,
  deadline: Date | string,
  gracePeriodSeconds = 30
): boolean {
  const submissionTime = new Date(submittedAt).getTime();
  const deadlineTime = new Date(deadline).getTime();
  const bufferMs = Math.max(0, gracePeriodSeconds) * 1000;

  return submissionTime > deadlineTime + bufferMs;
}
