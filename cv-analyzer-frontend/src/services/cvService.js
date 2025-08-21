/**
 * CV Service - Handle all CV-related API operations
 * Single responsibility: CV upload, processing, and retrieval
 */

import apiClient from './apiClient';

class CVService {
  /**
   * Upload CV files for processing
   * @param {FileList} files - CV files to upload
   * @returns {Promise} Upload response
   */
  async uploadCV(files) {
    const formData = new FormData();
    
    // Add files to form data
    Array.from(files).forEach((file, index) => {
      formData.append(`files`, file);
    });

    return await apiClient.uploadFile('/api/cv/cv/upload-cv', formData);
  }

  /**
   * Get CV processing status
   * @param {string} cvId - CV identifier
   * @returns {Promise} CV status and data
   */
  async getCVStatus(cvId) {
    return await apiClient.get(`/api/cv/${cvId}/status`);
  }

  /**
   * Get processed CV data
   * @param {string} cvId - CV identifier
   * @returns {Promise} Standardized CV data
   */
  async getCVData(cvId) {
    return await apiClient.get(`/api/cv/${cvId}`);
  }

  /**
   * Get list of all uploaded CVs
   * @returns {Promise} List of CVs
   */
  async listCVs() {
    return await apiClient.get('/api/cvs');
  }

  /**
   * Delete a CV
   * @param {string} cvId - CV identifier
   * @returns {Promise} Deletion response
   */
  async deleteCV(cvId) {
    return await apiClient.delete(`/api/cv/${cvId}`);
  }

  /**
   * Bulk upload CVs
   * @param {FileList} files - Multiple CV files
   * @returns {Promise} Bulk upload response
   */
  async bulkUploadCVs(files) {
    const formData = new FormData();
    
    Array.from(files).forEach((file) => {
      formData.append('cv_files', file);
    });

    return await apiClient.uploadFile('/api/bulk-upload-cvs', formData);
  }
}

export default new CVService();
