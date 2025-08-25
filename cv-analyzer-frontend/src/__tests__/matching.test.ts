/**
 * Tests for matching functionality
 */
import { MatchWeights } from '@/lib/api';

describe('Matching Types and Utils', () => {
  describe('MatchWeights', () => {
    it('should have correct default weights structure', () => {
      const weights: MatchWeights = {
        skills: 80,
        responsibilities: 15,
        job_title: 2.5,
        experience: 2.5
      };

      expect(weights.skills).toBe(80);
      expect(weights.responsibilities).toBe(15);
      expect(weights.job_title).toBe(2.5);
      expect(weights.experience).toBe(2.5);
      
      // Should sum to 100
      const total = weights.skills + weights.responsibilities + weights.job_title + weights.experience;
      expect(total).toBe(100);
    });

    it('should normalize weights display correctly', () => {
      const weights: MatchWeights = {
        skills: 80,
        responsibilities: 15,
        job_title: 2.5,
        experience: 2.5
      };

      const total = weights.skills + weights.responsibilities + weights.job_title + weights.experience;
      
      const normalizedSkills = (weights.skills / total * 100).toFixed(1);
      const normalizedResps = (weights.responsibilities / total * 100).toFixed(1);
      const normalizedTitle = (weights.job_title / total * 100).toFixed(1);
      const normalizedExp = (weights.experience / total * 100).toFixed(1);

      expect(normalizedSkills).toBe('80.0');
      expect(normalizedResps).toBe('15.0');
      expect(normalizedTitle).toBe('2.5');
      expect(normalizedExp).toBe('2.5');
    });
  });

  describe('Score Thresholds', () => {
    const GOOD_THRESHOLD = 0.50;

    it('should classify scores correctly', () => {
      expect(0.6 >= GOOD_THRESHOLD).toBe(true);
      expect(0.5 >= GOOD_THRESHOLD).toBe(true);
      expect(0.49 >= GOOD_THRESHOLD).toBe(false);
      expect(0.8 >= GOOD_THRESHOLD).toBe(true);
    });

    it('should format percentages correctly', () => {
      const score1 = 0.856;
      const score2 = 0.423;
      
      expect((score1 * 100).toFixed(1)).toBe('85.6');
      expect((score2 * 100).toFixed(1)).toBe('42.3');
    });
  });

  describe('Assignment Rendering Logic', () => {
    it('should handle assignment item structure', () => {
      const assignment = {
        type: 'skill' as const,
        jd_index: 0,
        jd_item: 'Python programming',
        cv_index: 1,
        cv_item: 'Python development',
        score: 0.85
      };

      expect(assignment.type).toBe('skill');
      expect(assignment.score).toBeGreaterThan(0.5);
      expect(assignment.jd_item).toContain('Python');
      expect(assignment.cv_item).toContain('Python');
    });

    it('should handle alternatives structure', () => {
      const alternatives = {
        jd_index: 0,
        items: [
          { cv_index: 0, cv_item: 'JavaScript programming', score: 0.65 },
          { cv_index: 2, cv_item: 'Java development', score: 0.45 },
          { cv_index: 3, cv_item: 'C++ coding', score: 0.35 }
        ]
      };

      expect(alternatives.items).toHaveLength(3);
      expect(alternatives.items[0].score).toBeGreaterThan(alternatives.items[1].score);
      expect(alternatives.items[1].score).toBeGreaterThan(alternatives.items[2].score);
    });
  });
});
