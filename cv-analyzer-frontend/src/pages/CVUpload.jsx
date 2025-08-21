/**
 * CVUpload Page - Handle CV file uploads
 * Single responsibility: CV upload interface and management
 */

import React from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { formatFileSize } from '../utils/fileUtils';
import { formatDate } from '../utils/formatUtils';

const CVUpload = ({ onUploadComplete }) => {
  const {
    files,
    isUploading,
    uploadProgress,
    errors,
    uploadResults,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    handleFileChange,
    handleDrop,
    handleDragOver,
    getStats
  } = useFileUpload({
    fileType: 'cv',
    maxFiles: 50,
    onUploadComplete: onUploadComplete
  });

  const stats = getStats();

  return (
    <div className="cv-upload-container">
      <div className="upload-header">
        <h2>Upload CV Files</h2>
        <p>Select or drag and drop CV files (PDF, DOCX, TXT, Images)</p>
      </div>

      {/* File Drop Zone */}
      <div 
        className={`drop-zone ${files.length > 0 ? 'has-files' : ''} ${isUploading ? 'uploading' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="drop-zone-content">
          <div className="drop-icon">📄</div>
          <p>Drag and drop CV files here</p>
          <p>or</p>
          <label className="file-input-label">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.tiff,.bmp"
              onChange={handleFileChange}
              disabled={isUploading}
              className="file-input-hidden"
            />
            <span className="file-input-button">Choose Files</span>
          </label>
        </div>
      </div>

      {/* Upload Statistics */}
      {stats.totalFiles > 0 && (
        <div className="upload-stats">
          <div className="stat-item">
            <span className="stat-label">Files:</span>
            <span className="stat-value">{stats.totalFiles}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Total Size:</span>
            <span className="stat-value">{formatFileSize(stats.totalSize)}</span>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="error-container">
          <h4>Upload Errors:</h4>
          <ul className="error-list">
            {errors.map((error, index) => (
              <li key={index} className="error-item">{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="file-list-container">
          <div className="file-list-header">
            <h3>Selected Files ({files.length})</h3>
            <button 
              onClick={clearFiles}
              disabled={isUploading}
              className="clear-button"
            >
              Clear All
            </button>
          </div>
          
          <div className="file-list">
            {files.map((file, index) => (
              <div key={index} className="file-item">
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-details">
                    {formatFileSize(file.size)} • {file.type}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  disabled={isUploading}
                  className="remove-button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="upload-progress-container">
          <div className="progress-info">
            <span>Uploading files...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div className="upload-results">
          <h3>Upload Results</h3>
          <div className="results-summary">
            <div className="result-item">
              <span className="result-label">Processed:</span>
              <span className="result-value">{uploadResults.processed_count || 0}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Success:</span>
              <span className="result-value success">{uploadResults.success_count || 0}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Failed:</span>
              <span className="result-value error">{uploadResults.failed_count || 0}</span>
            </div>
          </div>
          
          {uploadResults.results && uploadResults.results.length > 0 && (
            <div className="detailed-results">
              {uploadResults.results.map((result, index) => (
                <div key={index} className={`result-detail ${result.success ? 'success' : 'error'}`}>
                  <div className="result-filename">{result.filename}</div>
                  <div className="result-status">
                    {result.success ? '✅ Success' : `❌ ${result.error}`}
                  </div>
                  {result.cv_id && (
                    <div className="result-id">ID: {result.cv_id}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <div className="upload-actions">
        <button
          onClick={() => uploadFiles()}
          disabled={!stats.canUpload}
          className={`upload-button ${stats.canUpload ? 'enabled' : 'disabled'}`}
        >
          {isUploading ? 'Uploading...' : `Upload ${files.length} CV${files.length !== 1 ? 's' : ''}`}
        </button>
      </div>

      <style jsx>{`
        .cv-upload-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .upload-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .upload-header h2 {
          color: #333;
          margin-bottom: 10px;
        }
        
        .upload-header p {
          color: #666;
          font-size: 14px;
        }
        
        .drop-zone {
          border: 2px dashed #ddd;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          background: #fafafa;
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .drop-zone:hover,
        .drop-zone.has-files {
          border-color: #007bff;
          background: #f0f8ff;
        }
        
        .drop-zone.uploading {
          opacity: 0.6;
          pointer-events: none;
        }
        
        .drop-zone-content {
          pointer-events: none;
        }
        
        .drop-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        
        .file-input-hidden {
          display: none;
        }
        
        .file-input-label {
          pointer-events: all;
        }
        
        .file-input-button {
          display: inline-block;
          padding: 10px 20px;
          background: #007bff;
          color: white;
          border-radius: 5px;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        
        .file-input-button:hover {
          background: #0056b3;
        }
        
        .upload-stats {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        
        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .stat-label {
          font-size: 12px;
          color: #666;
        }
        
        .stat-value {
          font-weight: bold;
          color: #333;
        }
        
        .error-container {
          margin: 20px 0;
          padding: 15px;
          background: #fff5f5;
          border: 1px solid #fed7d7;
          border-radius: 5px;
        }
        
        .error-container h4 {
          color: #c53030;
          margin-bottom: 10px;
        }
        
        .error-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .error-item {
          color: #c53030;
          font-size: 14px;
          margin-bottom: 5px;
        }
        
        .file-list-container {
          margin: 20px 0;
        }
        
        .file-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        
        .clear-button {
          padding: 5px 15px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .clear-button:hover {
          background: #c82333;
        }
        
        .clear-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .file-list {
          border: 1px solid #ddd;
          border-radius: 5px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .file-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          border-bottom: 1px solid #eee;
        }
        
        .file-item:last-child {
          border-bottom: none;
        }
        
        .file-info {
          flex: 1;
        }
        
        .file-name {
          font-weight: 500;
          margin-bottom: 3px;
        }
        
        .file-details {
          font-size: 12px;
          color: #666;
        }
        
        .remove-button {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 16px;
          padding: 5px;
        }
        
        .remove-button:hover {
          background: #f8f9fa;
          border-radius: 3px;
        }
        
        .upload-progress-container {
          margin: 20px 0;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        
        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        
        .progress-bar {
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }
        
        .upload-results {
          margin: 20px 0;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 5px;
        }
        
        .upload-results h3 {
          margin-bottom: 15px;
          color: #333;
        }
        
        .results-summary {
          display: flex;
          gap: 20px;
          margin-bottom: 20px;
        }
        
        .result-item {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .result-label {
          font-size: 12px;
          color: #666;
        }
        
        .result-value {
          font-weight: bold;
          font-size: 18px;
        }
        
        .result-value.success {
          color: #28a745;
        }
        
        .result-value.error {
          color: #dc3545;
        }
        
        .detailed-results {
          border: 1px solid #ddd;
          border-radius: 5px;
          max-height: 200px;
          overflow-y: auto;
        }
        
        .result-detail {
          padding: 10px;
          border-bottom: 1px solid #eee;
        }
        
        .result-detail:last-child {
          border-bottom: none;
        }
        
        .result-detail.success {
          background: #f8fff9;
        }
        
        .result-detail.error {
          background: #fff5f5;
        }
        
        .result-filename {
          font-weight: 500;
          margin-bottom: 3px;
        }
        
        .result-status {
          font-size: 12px;
          margin-bottom: 3px;
        }
        
        .result-id {
          font-size: 10px;
          color: #666;
          font-family: monospace;
        }
        
        .upload-actions {
          text-align: center;
          margin-top: 30px;
        }
        
        .upload-button {
          padding: 12px 30px;
          font-size: 16px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .upload-button.enabled {
          background: #28a745;
          color: white;
        }
        
        .upload-button.enabled:hover {
          background: #218838;
        }
        
        .upload-button.disabled {
          background: #6c757d;
          color: white;
          cursor: not-allowed;
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
};

export default CVUpload;
