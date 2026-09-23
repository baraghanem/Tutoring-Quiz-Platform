import { describe, it, expect } from 'vitest';
import { calculateScore, QuestionResult } from '../src/lib/scoring';

describe('calculateScore', () => {
  const baseQuestions: QuestionResult[] = [
    { question_id: 1, points: 2, selected_option_id: 10, correct_option_id: 10 }, // correct
    { question_id: 2, points: 2, selected_option_id: 21, correct_option_id: 20 }, // wrong
    { question_id: 3, points: 1, selected_option_id: null, correct_option_id: 30 }, // skipped
  ];

  describe('without negative marking', () => {
    it('scores only correct answers', () => {
      const result = calculateScore(baseQuestions, false, 0.25);
      expect(result.score).toBe(2);        // Q1 correct: +2
      expect(result.max_score).toBe(5);    // 2 + 2 + 1
      expect(result.correct_count).toBe(1);
      expect(result.wrong_count).toBe(1);
      expect(result.unanswered_count).toBe(1);
      expect(result.percentage).toBe(40);
    });

    it('scores 100% when all correct', () => {
      const allCorrect: QuestionResult[] = [
        { question_id: 1, points: 1, selected_option_id: 10, correct_option_id: 10 },
        { question_id: 2, points: 1, selected_option_id: 20, correct_option_id: 20 },
      ];
      const result = calculateScore(allCorrect, false, 0.25);
      expect(result.score).toBe(2);
      expect(result.percentage).toBe(100);
    });

    it('does not penalise wrong answers', () => {
      const allWrong: QuestionResult[] = [
        { question_id: 1, points: 5, selected_option_id: 99, correct_option_id: 10 },
      ];
      const result = calculateScore(allWrong, false, 0.25);
      expect(result.score).toBe(0);
    });
  });

  describe('with negative marking (penalty 0.25)', () => {
    it('deducts 25% of question points for wrong answer', () => {
      const questions: QuestionResult[] = [
        { question_id: 1, points: 2, selected_option_id: 10, correct_option_id: 10 }, // +2
        { question_id: 2, points: 2, selected_option_id: 21, correct_option_id: 20 }, // -0.5
      ];
      const result = calculateScore(questions, true, 0.25);
      expect(result.score).toBe(1.5);
    });

    it('does not penalise skipped questions', () => {
      const questions: QuestionResult[] = [
        { question_id: 1, points: 4, selected_option_id: null, correct_option_id: 10 },
      ];
      const result = calculateScore(questions, true, 0.25);
      expect(result.score).toBe(0);
      expect(result.unanswered_count).toBe(1);
    });

    it('clamps score to 0 even with many wrong answers', () => {
      const allWrong: QuestionResult[] = Array.from({ length: 10 }, (_, i) => ({
        question_id: i + 1,
        points: 2,
        selected_option_id: 99,
        correct_option_id: i + 1,
      }));
      const result = calculateScore(allWrong, true, 0.25);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('with negative marking (penalty 0.33)', () => {
    it('deducts 33% for wrong answers', () => {
      const questions: QuestionResult[] = [
        { question_id: 1, points: 3, selected_option_id: 10, correct_option_id: 10 }, // +3
        { question_id: 2, points: 3, selected_option_id: 99, correct_option_id: 20 }, // -0.99
      ];
      const result = calculateScore(questions, true, 0.33);
      expect(result.score).toBeCloseTo(2.01, 1);
    });
  });

  describe('edge cases', () => {
    it('handles empty question list', () => {
      const result = calculateScore([], false, 0.25);
      expect(result.score).toBe(0);
      expect(result.max_score).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('handles fractional point values', () => {
      const questions: QuestionResult[] = [
        { question_id: 1, points: 0.5, selected_option_id: 10, correct_option_id: 10 },
      ];
      const result = calculateScore(questions, false, 0.25);
      expect(result.score).toBe(0.5);
      expect(result.percentage).toBe(100);
    });

    it('correctly computes percentage', () => {
      const questions: QuestionResult[] = [
        { question_id: 1, points: 1, selected_option_id: 10, correct_option_id: 10 },
        { question_id: 2, points: 1, selected_option_id: 10, correct_option_id: 10 },
        { question_id: 3, points: 1, selected_option_id: 99, correct_option_id: 30 },
        { question_id: 4, points: 1, selected_option_id: 99, correct_option_id: 40 },
      ];
      const result = calculateScore(questions, false, 0.25);
      expect(result.percentage).toBe(50);
    });
  });
});
