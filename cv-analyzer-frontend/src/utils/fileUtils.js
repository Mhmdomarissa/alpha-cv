/**
 * File Utilities - Handle file operations and validations
 * Single responsibility: File handling, validation, and processing
 */

// Supported file types
export const SUPPORTED_CV_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/tiff',
  'image/bmp'
];

export const SUPPORTED_JD_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/plain'
];

// File size limits (in bytes)
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_COUNT = 50;

/**
 * Validate file type for CV uploads
 * @param {File} file - File to validate
 * @returns {boolean} Is valid CV file type
 */
export const isValidCVFile = (file) => {
  return SUPPORTED_CV_TYPES.includes(file.type);
};

/**
 * Validate file type for JD uploads
 * @param {File} file - File to validate
 * @returns {boolean} Is valid JD file type
 */
export const isValidJDFile = (file) => {
  return SUPPORTED_JD_TYPES.includes(file.type);
};

/**
 * Validate file size
 * @param {File} file - File to validate
 * @param {number} maxSize - Maximum size in bytes (optional)
 * @returns {boolean} Is valid file size
 */
export const isValidFileSize = (file, maxSize = MAX_FILE_SIZE) => {
  return file.size <= maxSize;
};

/**
 * Validate multiple files
 * @param {FileList} files - Files to validate
 * @param {string} type - 'cv' or 'jd'
 * @returns {Object} Validation result with errors
 */
export const validateFiles = (files, type = 'cv') => {
  const errors = [];
  const validFiles = [];
  const isValidType = type === 'cv' ? isValidCVFile : isValidJDFile;

  if (files.length > MAX_FILES_COUNT) {
    errors.push(`Maximum ${MAX_FILES_COUNT} files allowed`);
    return { valid: false, errors, validFiles: [] };
  }

  Array.from(files).forEach((file, index) => {
    const fileErrors = [];
    
    if (!isValidType(file)) {
      fileErrors.push(`Invalid file type: ${file.name}`);
    }
    
    if (!isValidFileSize(file)) {
      fileErrors.push(`File too large: ${file.name} (${formatFileSize(file.size)})`);
    }

    if (fileErrors.length === 0) {
      validFiles.push(file);
    } else {
      errors.push(...fileErrors);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    validFiles,
    totalFiles: files.length,
    validCount: validFiles.length
  };
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get file extension from filename
 * @param {string} filename - File name
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

/**
 * Generate unique file ID
 * @param {File} file - File object
 * @returns {string} Unique file identifier
 */
export const generateFileId = (file) => {
  return `${file.name}_${file.size}_${Date.now()}`;
};

/**
 * Convert files to array for easier manipulation
 * @param {FileList} fileList - HTML FileList object
 * @returns {File[]} Array of files
 */
export const fileListToArray = (fileList) => {
  return Array.from(fileList);
};

/**
 * Read file as text (for text files)
 * @param {File} file - File to read
 * @returns {Promise<string>} File content as text
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
};

/**
 * Read file as data URL (for previews)
 * @param {File} file - File to read
 * @returns {Promise<string>} File content as data URL
 */
export const readFileAsDataURL = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};
