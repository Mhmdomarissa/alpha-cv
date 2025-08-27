import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { MatchRequest, MatchResponse, MatchWeights } from '@/lib/types';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Type Safety', () => {
    it('should have correct MatchRequest type structure', () => {
      const matchRequest: MatchRequest = {
        jd_id: 'test-jd-id',
        cv_ids: ['cv1', 'cv2'],
        weights: {
          skills: 80,
          responsibilities: 15,
          job_title: 2.5,
          experience: 2.5,
        },
        top_alternatives: 3,
      };

      expect(matchRequest.jd_id).toBe('test-jd-id');
      expect(matchRequest.cv_ids).toHaveLength(2);
      expect(matchRequest.weights?.skills).toBe(80);
    });

    it('should have correct MatchWeights type structure', () => {
      const weights: MatchWeights = {
        skills: 80,
        responsibilities: 15,
        job_title: 2.5,
        experience: 2.5,
      };

      expect(weights.skills).toBe(80);
      expect(weights.responsibilities).toBe(15);
      expect(weights.job_title).toBe(2.5);
      expect(weights.experience).toBe(2.5);
    });

    it('should accept optional fields in MatchRequest', () => {
      const minimalRequest: MatchRequest = {
        jd_text: 'Sample job description text',
      };

      expect(minimalRequest.jd_text).toBeDefined();
      expect(minimalRequest.jd_id).toBeUndefined();
      expect(minimalRequest.cv_ids).toBeUndefined();
    });
  });

  describe('API Functions', () => {
    it('should have all required API functions', () => {
      expect(typeof api.healthCheck).toBe('function');
      expect(typeof api.uploadCV).toBe('function');
      expect(typeof api.uploadJD).toBe('function');
      expect(typeof api.listCVs).toBe('function');
      expect(typeof api.listJDs).toBe('function');
      expect(typeof api.matchCandidates).toBe('function');
    });
  });
});
