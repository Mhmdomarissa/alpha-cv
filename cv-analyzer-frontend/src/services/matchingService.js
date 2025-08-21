/**
 * Matching Service - Handle CV-JD matching operations
 * Single responsibility: Matching algorithms and result processing
 */

import apiClient from './apiClient';

class MatchingService {
  /**
   * Match single CV against single JD
   * @param {string} cvId - CV identifier
   * @param {string} jdId - JD identifier
   * @returns {Promise} Matching result with score and details
   */
  async matchCVWithJD(cvId, jdId) {
    return await apiClient.post('/api/match', {
      cv_id: cvId,
      jd_id: jdId
    });
  }

  /**
   * Bulk match multiple CVs against a JD
   * @param {string} jdId - JD identifier
   * @param {string[]} cvIds - Array of CV identifiers
   * @returns {Promise} Bulk matching results
   */
  async bulkMatchCVs(jdId, cvIds) {
    return await apiClient.post('/api/bulk-match', {
      jd_id: jdId,
      cv_ids: cvIds
    });
  }

  /**
   * Match CVs using uploaded files (all-in-one endpoint)
   * @param {FileList} cvFiles - CV files
   * @param {FileList} jdFiles - JD files
   * @returns {Promise} Complete matching results
   */
  async matchFiles(cvFiles, jdFiles) {
    const formData = new FormData();
    
    // Add CV files
    Array.from(cvFiles).forEach((file) => {
      formData.append('cv_files', file);
    });
    
    // Add JD files
    Array.from(jdFiles).forEach((file) => {
      formData.append('jd_files', file);
    });

    return await apiClient.uploadFile('/api/jobs/standardize-and-match-text', formData);
  }

  /**
   * Get matching history
   * @param {Object} filters - Optional filters (date, score range, etc.)
   * @returns {Promise} Matching history
   */
  async getMatchingHistory(filters = {}) {
    const queryParams = new URLSearchParams(filters).toString();
    return await apiClient.get(`/api/matching-history?${queryParams}`);
  }

  /**
   * Get detailed match analysis
   * @param {string} matchId - Match result identifier
   * @returns {Promise} Detailed match analysis
   */
  async getMatchDetails(matchId) {
    return await apiClient.get(`/api/match/${matchId}/details`);
  }

  /**
   * Export matching results
   * @param {string} matchId - Match result identifier
   * @param {string} format - Export format ('pdf', 'csv', 'json')
   * @returns {Promise} Export file or download link
   */
  async exportResults(matchId, format = 'pdf') {
    return await apiClient.get(`/api/match/${matchId}/export?format=${format}`);
  }

  /**
   * Get system statistics
   * @returns {Promise} System statistics and metrics
   */
  async getSystemStats() {
    return await apiClient.get('/api/stats');
  }

  /**
   * Process matching score and provide interpretation
   * @param {number} score - Matching score (0-100)
   * @returns {Object} Score interpretation
   */
  interpretScore(score) {
    if (score >= 85) {
      return {
        level: 'excellent',
        description: 'Excellent match - highly recommended candidate',
        color: 'green'
      };
    } else if (score >= 70) {
      return {
        level: 'good',
        description: 'Good match - suitable candidate with minor gaps',
        color: 'blue'
      };
    } else if (score >= 50) {
      return {
        level: 'fair',
        description: 'Fair match - candidate needs development in key areas',
        color: 'yellow'
      };
    } else {
      return {
        level: 'poor',
        description: 'Poor match - significant skill/experience gaps',
        color: 'red'
      };
    }
  }
}

export default new MatchingService();
