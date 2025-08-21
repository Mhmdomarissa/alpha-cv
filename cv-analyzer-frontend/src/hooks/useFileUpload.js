/**
 * useFileUpload Hook - Handle file upload operations
 * Single responsibility: File upload state management and operations
 */

import { useState, useCallback } from 'react';
import { validateFiles } from '../utils/fileUtils';

export const useFileUpload = (options = {}) => {
  const {
    maxFiles = 50,
    fileType = 'cv', // 'cv' or 'jd'
    autoUpload = false,
    onUploadComplete = null,
    onUploadError = null
  } = options;

  // State management
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState([]);
  const [uploadResults, setUploadResults] = useState(null);

  /**
   * Add files to the upload queue
   */
  const addFiles = useCallback((newFiles) => {
    if (!newFiles || newFiles.length === 0) return;

    // Validate files
    const validation = validateFiles(newFiles, fileType);
    
    if (!validation.valid) {
      setErrors(validation.errors);
      return false;
    }

    // Check total file count
    const totalFiles = files.length + validation.validFiles.length;
    if (totalFiles > maxFiles) {
      setErrors([`Maximum ${maxFiles} files allowed. Current: ${files.length}, Adding: ${validation.validFiles.length}`]);
      return false;
    }

    // Add valid files
    setFiles(prevFiles => [...prevFiles, ...validation.validFiles]);
    setErrors([]);
    
    // Auto upload if enabled
    if (autoUpload && validation.validFiles.length > 0) {
      uploadFiles(validation.validFiles);
    }

    return true;
  }, [files, fileType, maxFiles, autoUpload]);

  /**
   * Remove a file from the upload queue
   */
  const removeFile = useCallback((index) => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
    setErrors([]);
  }, []);

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setErrors([]);
    setUploadResults(null);
    setUploadProgress(0);
  }, []);

  /**
   * Upload files to server
   */
  const uploadFiles = useCallback(async (filesToUpload = files) => {
    if (filesToUpload.length === 0) {
      setErrors(['No files to upload']);
      return null;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setErrors([]);

    try {
      // Create FormData
      const formData = new FormData();
      filesToUpload.forEach((file, index) => {
        formData.append(`files`, file);
      });

      // Simulate upload progress (you can replace with actual progress tracking)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      // Make upload request
      const endpoint = fileType === 'cv' ? '/api/jobs/upload-cv' : '/api/jobs/upload-jd';
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setUploadResults(result);
      
      // Call success callback
      if (onUploadComplete) {
        onUploadComplete(result);
      }

      // Clear files after successful upload
      setTimeout(() => {
        clearFiles();
      }, 1000);

      return result;

    } catch (error) {
      console.error('Upload error:', error);
      setErrors([error.message || 'Upload failed']);
      
      // Call error callback
      if (onUploadError) {
        onUploadError(error);
      }
      
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [files, fileType, onUploadComplete, onUploadError, clearFiles]);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback((event) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
  }, [addFiles]);

  /**
   * Handle drag and drop
   */
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, [addFiles]);

  /**
   * Handle drag over (required for drop to work)
   */
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
  }, []);

  /**
   * Get upload statistics
   */
  const getStats = useCallback(() => {
    return {
      totalFiles: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      isUploading,
      uploadProgress,
      hasErrors: errors.length > 0,
      canUpload: files.length > 0 && !isUploading
    };
  }, [files, isUploading, uploadProgress, errors]);

  return {
    // State
    files,
    isUploading,
    uploadProgress,
    errors,
    uploadResults,
    
    // Actions
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    
    // Event handlers
    handleFileChange,
    handleDrop,
    handleDragOver,
    
    // Utilities
    getStats
  };
};
