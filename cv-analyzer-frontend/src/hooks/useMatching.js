/**
 * useMatching Hook - Handle CV-JD matching operations
 * Single responsibility: Matching state management and operations
 */

import { useState, useCallback, useEffect } from 'react';
import matchingService from '../services/matchingService';

export const useMatching = () => {
  // State management
  const [isMatching, setIsMatching] = useState(false);
  const [matchResults, setMatchResults] = useState(null);
  const [matchHistory, setMatchHistory] = useState([]);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  /**
   * Match single CV against single JD
   */
  const matchSingle = useCallback(async (cvId, jdId) => {
    if (!cvId || !jdId) {
      setError('CV ID and JD ID are required');
      return null;
    }

    setIsMatching(true);
    setError(null);
    setProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 15;
        });
      }, 500);

      const result = await matchingService.matchCVWithJD(cvId, jdId);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setMatchResults(result);
      
      // Add to history
      setMatchHistory(prev => [result, ...prev]);
      
      return result;

    } catch (err) {
      console.error('Matching error:', err);
      setError(err.message || 'Matching failed');
      return null;
    } finally {
      setIsMatching(false);
      setTimeout(() => setProgress(0), 1000); // Reset progress after delay
    }
  }, []);

  /**
   * Bulk match multiple CVs against a JD
   */
  const matchBulk = useCallback(async (jdId, cvIds) => {
    if (!jdId || !cvIds || cvIds.length === 0) {
      setError('JD ID and CV IDs are required');
      return null;
    }

    setIsMatching(true);
    setError(null);
    setProgress(0);

    try {
      // Progress simulation for bulk matching
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 800);

      const results = await matchingService.bulkMatchCVs(jdId, cvIds);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setMatchResults(results);
      
      // Add all results to history
      if (Array.isArray(results)) {
        setMatchHistory(prev => [...results, ...prev]);
      }
      
      return results;

    } catch (err) {
      console.error('Bulk matching error:', err);
      setError(err.message || 'Bulk matching failed');
      return null;
    } finally {
      setIsMatching(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  /**
   * Match using uploaded files directly
   */
  const matchFiles = useCallback(async (cvFiles, jdFiles) => {
    if (!cvFiles || !jdFiles || cvFiles.length === 0 || jdFiles.length === 0) {
      setError('CV files and JD files are required');
      return null;
    }

    setIsMatching(true);
    setError(null);
    setProgress(0);

    try {
      // Extended progress for file processing + matching
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 8;
        });
      }, 1000);

      const results = await matchingService.matchFiles(cvFiles, jdFiles);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      setMatchResults(results);
      
      // Add to history if results are in expected format
      if (results && Array.isArray(results.matches)) {
        setMatchHistory(prev => [...results.matches, ...prev]);
      }
      
      return results;

    } catch (err) {
      console.error('File matching error:', err);
      setError(err.message || 'File matching failed');
      return null;
    } finally {
      setIsMatching(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  /**
   * Get match details for a specific match
   */
  const getMatchDetails = useCallback(async (matchId) => {
    try {
      return await matchingService.getMatchDetails(matchId);
    } catch (err) {
      console.error('Get match details error:', err);
      setError(err.message || 'Failed to get match details');
      return null;
    }
  }, []);

  /**
   * Load matching history from server
   */
  const loadHistory = useCallback(async (filters = {}) => {
    try {
      const history = await matchingService.getMatchingHistory(filters);
      setMatchHistory(history);
      return history;
    } catch (err) {
      console.error('Load history error:', err);
      setError(err.message || 'Failed to load matching history');
      return null;
    }
  }, []);

  /**
   * Clear current results
   */
  const clearResults = useCallback(() => {
    setMatchResults(null);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    setMatchHistory([]);
  }, []);

  /**
   * Export match results
   */
  const exportResults = useCallback(async (matchId, format = 'pdf') => {
    try {
      return await matchingService.exportResults(matchId, format);
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Export failed');
      return null;
    }
  }, []);

  /**
   * Get system statistics
   */
  const getSystemStats = useCallback(async () => {
    try {
      return await matchingService.getSystemStats();
    } catch (err) {
      console.error('System stats error:', err);
      setError(err.message || 'Failed to get system stats');
      return null;
    }
  }, []);

  /**
   * Interpret match score
   */
  const interpretScore = useCallback((score) => {
    return matchingService.interpretScore(score);
  }, []);

  /**
   * Get matching statistics
   */
  const getStats = useCallback(() => {
    const totalMatches = matchHistory.length;
    const averageScore = totalMatches > 0 
      ? matchHistory.reduce((sum, match) => sum + (match.overall_score || 0), 0) / totalMatches 
      : 0;
    
    const scoreDistribution = {
      excellent: matchHistory.filter(m => (m.overall_score || 0) >= 85).length,
      good: matchHistory.filter(m => (m.overall_score || 0) >= 70 && (m.overall_score || 0) < 85).length,
      fair: matchHistory.filter(m => (m.overall_score || 0) >= 50 && (m.overall_score || 0) < 70).length,
      poor: matchHistory.filter(m => (m.overall_score || 0) < 50).length
    };

    return {
      totalMatches,
      averageScore: Math.round(averageScore),
      scoreDistribution,
      isMatching,
      hasResults: !!matchResults,
      hasError: !!error
    };
  }, [matchHistory, matchResults, error, isMatching]);

  // Load initial history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    // State
    isMatching,
    matchResults,
    matchHistory,
    error,
    progress,
    
    // Actions
    matchSingle,
    matchBulk,
    matchFiles,
    getMatchDetails,
    loadHistory,
    clearResults,
    clearHistory,
    exportResults,
    getSystemStats,
    
    // Utilities
    interpretScore,
    getStats
  };
};
