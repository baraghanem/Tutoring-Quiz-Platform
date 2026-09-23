/**
 * Scoring logic for the quiz platform.
 * Supports normal scoring and negative marking.
 *
 * With negative marking:
 *   - Correct answer:   +question.points
 *   - Wrong answer:     -question.points * penalty_fraction
 *   - Unanswered:       0
 *   - Minimum score:    clamped at 0
 *
 * Without negative marking:
 *   - Correct answer:   +question.points
 *   - Wrong/unanswered: 0
 */

export interface QuestionResult {
  question_id: number;
  points: number;
  selected_option_id: number | null;
  correct_option_id: number;
}

export interface ScoreResult {
  score: number;
  max_score: number;
  correct_count: number;
  wrong_count: number;
  unanswered_count: number;
  percentage: number;
}

export function calculateScore(
  questions: QuestionResult[],
  negative_marking: boolean,
  penalty_fraction: number
): ScoreResult {
  let score = 0;
  let max_score = 0;
  let correct_count = 0;
  let wrong_count = 0;
  let unanswered_count = 0;

  for (const q of questions) {
    max_score += q.points;

    if (q.selected_option_id === null) {
      unanswered_count++;
      // No penalty for unanswered
    } else if (q.selected_option_id === q.correct_option_id) {
      score += q.points;
      correct_count++;
    } else {
      wrong_count++;
      if (negative_marking) {
        score -= q.points * penalty_fraction;
      }
    }
  }

  // Score cannot go below 0
  score = Math.max(0, score);

  const percentage = max_score > 0 ? Math.round((score / max_score) * 100) : 0;

  return {
    score: Math.round(score * 100) / 100,
    max_score: Math.round(max_score * 100) / 100,
    correct_count,
    wrong_count,
    unanswered_count,
    percentage,
  };
}
