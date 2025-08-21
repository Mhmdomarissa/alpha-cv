/**
 * JD Service - Handle all Job Description related API operations
 * Single responsibility: JD upload, processing, and retrieval
 */

import apiClient from './apiClient';

class JDService {
  /**
   * Upload Job Description files for processing
   * @param {FileList} files - JD files to upload (.pdf, .docx, .txt)
   * @returns {Promise} Upload response
   */
  async uploadJD(files) {
    const formData = new FormData();
    
    // Add files to form data
    Array.from(files).forEach((file) => {
      formData.append('jd_files', file);
    });

    return await apiClient.uploadFile('/api/upload-jd', formData);
  }

  /**
   * Upload JD from text content
   * @param {string} text - JD text content
   * @param {string} title - JD title/name
   * @returns {Promise} Upload response
   */
  async uploadJDText(text, title = 'Job Description') {
    return await apiClient.post('/api/upload-jd-text', {
      text,
      title
    });
  }

  /**
   * Get JD processing status
   * @param {string} jdId - JD identifier
   * @returns {Promise} JD status and data
   */
  async getJDStatus(jdId) {
    return await apiClient.get(`/api/jd/${jdId}/status`);
  }

  /**
   * Get processed JD data
   * @param {string} jdId - JD identifier
   * @returns {Promise} Standardized JD data
   */
  async getJDData(jdId) {
    return await apiClient.get(`/api/jd/${jdId}`);
  }

  /**
   * Get list of all uploaded JDs
   * @returns {Promise} List of JDs
   */
  async listJDs() {
    return await apiClient.get('/api/jds');
  }

  /**
   * Delete a JD
   * @param {string} jdId - JD identifier
   * @returns {Promise} Deletion response
   */
  async deleteJD(jdId) {
    return await apiClient.delete(`/api/jd/${jdId}`);
  }

  /**
   * Standardize JD text using AI
   * @param {string} text - Raw JD text
   * @returns {Promise} Standardized JD response
   */
  async standardizeJD(text) {
    return await apiClient.post('/api/standardize-jd', { text });
  }
}

export default new JDService();
